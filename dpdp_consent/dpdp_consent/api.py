import frappe
from frappe.utils import now_datetime, add_to_date, generate_hash
from typing import Optional


def _write_audit(event_type, user_identifier, details, success=True, state_token_ref=""):
    try:
        ip = frappe.local.request.environ.get(
            "HTTP_X_FORWARDED_FOR",
            frappe.local.request.environ.get("REMOTE_ADDR", "unknown")
        ) if frappe.local.request else "system"

        doc = frappe.new_doc("Consent Audit Log")
        doc.event_type      = event_type
        doc.user_identifier = user_identifier
        doc.state_token_ref = state_token_ref
        doc.details         = details
        doc.ip_address      = ip
        doc.timestamp       = now_datetime()
        doc.success         = 1 if success else 0
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
    except Exception as e:
        frappe.log_error(f"Audit write failed: {str(e)}", "DPDP Audit Error")


@frappe.whitelist(allow_guest=True)
def check_session(user_identifier, purpose):
    ip = frappe.local.request.environ.get(
        "HTTP_X_FORWARDED_FOR",
        frappe.local.request.environ.get("REMOTE_ADDR", "unknown")
    ) if frappe.local.request else "unknown"

    _write_audit(
        event_type      = "PAGE_OPENED",
        user_identifier = user_identifier,
        details         = f"User '{user_identifier}' opened consent page. Purpose: {purpose}"
    )

    existing = frappe.get_list(
        "Consent Request",
        filters={"username": user_identifier, "approval_status": ["in", ["Approved", "Denied"]]},
        fields=["name", "approval_status"],
        limit=1
    )

    if existing:
        _write_audit(
            event_type      = "DUPLICATE_SESSION",
            user_identifier = user_identifier,
            details         = f"User already has a completed consent: {existing[0].get('approval_status')}"
        )
        return {
            "already_consented": True,
            "existing_status":   existing[0].get("approval_status"),
            "can_proceed":       False,
            "message":           f"Already completed. Status: {existing[0].get('approval_status')}"
        }

    return {
        "already_consented": False,
        "can_proceed":       True,
        "message":           "Session clear. Proceed to consent form."
    }


@frappe.whitelist(allow_guest=True)
def initiate_consent(user_identifier, purpose):
    ip = frappe.local.request.environ.get(
        "HTTP_X_FORWARDED_FOR",
        frappe.local.request.environ.get("REMOTE_ADDR", "unknown")
    ) if frappe.local.request else "unknown"

    # Expire old active sessions
    old_sessions = frappe.get_list(
        "Consent Session",
        filters={"user_identifier": user_identifier, "session_status": "Active"},
        fields=["name"]
    )
    for old in old_sessions:
        frappe.db.set_value("Consent Session", old["name"], "session_status", "Expired")

    state_token = generate_hash(length=64)
    expires_at  = add_to_date(now_datetime(), minutes=30)

    session_doc = frappe.new_doc("Consent Session")
    session_doc.user_identifier = user_identifier
    session_doc.state_token     = state_token
    session_doc.purpose         = purpose
    session_doc.session_status  = "Active"
    session_doc.expires_at      = expires_at
    session_doc.ip_address      = ip
    session_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    _write_audit(
        event_type      = "SESSION_CREATED",
        user_identifier = user_identifier,
        state_token_ref = state_token[:16] + "...",
        details         = f"State token generated for '{user_identifier}'. Expires at {expires_at}."
    )

    return {
        "state_token":        state_token,
        "purpose":            purpose,
        "expires_in_minutes": 30,
        "message":            "Token generated. Present consent form to user."
    }


@frappe.whitelist(allow_guest=True)
def submit_consent(state_token, user_name, purpose, decision, identity_type=None, dependent_name=None, relationship=None):
    ip = frappe.local.request.environ.get(
        "HTTP_X_FORWARDED_FOR",
        frappe.local.request.environ.get("REMOTE_ADDR", "unknown")
    ) if frappe.local.request else "unknown"

    # STEP 7 — Validate state token
    session_list = frappe.get_list(
        "Consent Session",
        filters={"state_token": state_token, "session_status": "Active"},
        fields=["name", "expires_at", "user_identifier"]
    )

    if not session_list:
        _write_audit(
            event_type      = "CSRF_FAILED",
            user_identifier = user_name,
            state_token_ref = state_token[:16] + "...",
            details         = "State token not found or already used.",
            success         = False
        )
        frappe.throw("Invalid or expired session token. Please start over.")

    session = session_list[0]

    if now_datetime() > session["expires_at"]:
        frappe.db.set_value("Consent Session", session["name"], "session_status", "Expired")
        _write_audit(
            event_type      = "CSRF_FAILED",
            user_identifier = user_name,
            state_token_ref = state_token[:16] + "...",
            details         = "State token expired.",
            success         = False
        )
        frappe.throw("Session expired. Please start over.")

    # Mark session as used
    frappe.db.set_value("Consent Session", session["name"], "session_status", "Used")
    frappe.db.commit()

    _write_audit(
        event_type      = "CSRF_VALIDATED",
        user_identifier = user_name,
        state_token_ref = state_token[:16] + "...",
        details         = "State token validated successfully."
    )

    # STEP 8 — Save Consent Request
    _write_audit(
        event_type      = "DECISION_RECEIVED",
        user_identifier = user_name,
        details         = f"Decision: {decision}"
    )

    consent_doc = frappe.new_doc("Consent Request")
    consent_doc.username        = user_name
    consent_doc.purpose         = purpose
    consent_doc.decision        = decision
    consent_doc.approval_status = "Approved" if decision == "Approve" else "Denied"
    consent_doc.consent_for     = identity_type or "Self"
    consent_doc.state_token     = "DPDP-" + generate_hash(length=6)
    if dependent_name:
        consent_doc.dependant_details = dependent_name
    consent_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    _write_audit(
        event_type      = "CONSENT_SAVED",
        user_identifier = user_name,
        details         = f"Consent Request {consent_doc.name} saved. Status: {consent_doc.approval_status}"
    )

    artefact_token = None

    # STEP 9 — Create Artefact if Approved
    if decision == "Approve":
        artefact_token = generate_hash(length=32)

        artefact = frappe.new_doc("Consent Artefact")
        artefact.consent_request_id = consent_doc.name
        artefact.user_name          = user_name
        artefact.purpose            = purpose
        artefact.identity_type      = identity_type or "Self"
        artefact.artefact_token     = artefact_token
        artefact.consented_at       = now_datetime()
        artefact.ip_address         = ip
        artefact.status             = "Active"
        artefact.insert(ignore_permissions=True)
        frappe.db.commit()

        _write_audit(
            event_type      = "ARTEFACT_CREATED",
            user_identifier = user_name,
            details         = f"Consent Artefact created. Token: {artefact_token[:8]}..."
        )

    return {
        "status":          consent_doc.approval_status,
        "consent_id":      consent_doc.name,
        "artefact_token":  artefact_token,
        "message":         "Consent recorded successfully."
    }


@frappe.whitelist(allow_guest=True)
def verify_artefact(artefact_token):
    results = frappe.get_list(
        "Consent Artefact",
        filters={"artefact_token": artefact_token},
        fields=["name", "purpose", "consented_at", "status", "user_name"]
    )

    if not results:
        return {"valid": False, "message": "Artefact token not found."}

    r = results[0]
    return {
        "valid":        True,
        "purpose":      r["purpose"],
        "consented_at": str(r["consented_at"]),
        "status":       r["status"],
        "user_name":    r["user_name"]
    }


@frappe.whitelist(allow_guest=True)
def get_audit_trail(user_identifier):
    logs = frappe.get_list(
        "Consent Audit Log",
        filters={"user_identifier": user_identifier},
        fields=["event_type", "details", "timestamp", "success", "ip_address"],
        order_by="timestamp desc"
    )
    return logs
