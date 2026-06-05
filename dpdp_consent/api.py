import frappe
import secrets
from frappe.utils import now_datetime


@frappe.whitelist(allow_guest=True)
def check_session(user_identifier, purpose):

    existing = frappe.db.exists(
        "Consent Request",
        {
            "username": user_identifier,
            "purpose": purpose
        }
    )

    if existing:
        doc = frappe.get_doc("Consent Request", existing)

        return {
            "already_consented": True,
            "existing_status": doc.approval_status or "Pending"
        }

    return {
        "already_consented": False
    }


@frappe.whitelist(allow_guest=True)
def initiate_consent(user_identifier, purpose):

    return {
        "state_token": secrets.token_hex(16)
    }


@frappe.whitelist(allow_guest=True)
def submit_consent(
    state_token=None,
    user_name=None,
    purpose=None,
    decision=None,
    identity_type=None,
    dependent_name=None
):

    if not user_name:
        frappe.throw("User Name is required")

    if not purpose:
        frappe.throw("Purpose is required")

    if not decision:
        frappe.throw("Decision is required")

    approval_status = "Approved"

    if decision == "Deny":
        approval_status = "Denied"

    doc = frappe.get_doc({
        "doctype": "Consent Request",
        "username": user_name,
        "purpose": purpose,
        "decision": decision,
        "approval_status": approval_status,
        "consent_for": identity_type or "Self",
        "dependent_details": dependent_name or "",
        "consent_date": now_datetime()
    })

    doc.insert(ignore_permissions=True)

    frappe.db.commit()

    return {
        "status": approval_status
    }


@frappe.whitelist(allow_guest=True)
def get_consent_records():

    return frappe.get_all(
        "Consent Request",
        fields=[
            "name",
            "username",
            "purpose",
            "decision",
            "approval_status",
            "consent_for",
            "consent_date"
        ],
        order_by="creation desc"
    )


@frappe.whitelist(allow_guest=True)
def get_audit_logs():
    return []
