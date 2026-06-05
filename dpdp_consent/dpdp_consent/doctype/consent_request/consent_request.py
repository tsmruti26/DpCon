import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime
import secrets


class ConsentRequest(Document):

    def before_insert(self):

        # Generate state token if missing
        if not getattr(self, "state_token", None):
            self.state_token = secrets.token_hex(16)

        # Set consent date if missing
        if not getattr(self, "consent_date", None):
            self.consent_date = now_datetime()

        # Auto-set approval status from decision
        if getattr(self, "decision", None) == "Approve":
            self.approval_status = "Approved"

        elif getattr(self, "decision", None) == "Deny":
            self.approval_status = "Denied"

        elif not getattr(self, "approval_status", None):
            self.approval_status = "Pending"


@frappe.whitelist()
def get_consent_records():

    return frappe.get_all(
        "Consent Request",
        fields=[
            "name",
            "username",
            "consent_for",
            "purpose",
            "decision",
            "approval_status",
            "consent_date",
            "state_token"
        ],
        order_by="creation desc"
    )


@frappe.whitelist()
def get_audit_logs():

    if not frappe.db.exists("DocType", "Consent Audit Log"):
        return []

    return frappe.get_all(
        "Consent Audit Log",
        fields=[
            "event_type",
            "user_identifier",
            "details",
            "ip_address",
            "timestamp",
            "success"
        ],
        order_by="creation desc",
        limit=50
    )
