import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime
import secrets


class ConsentArtefact(Document):

    def before_insert(self):

        if not self.status:
            self.status = "Active"

        if not self.artefact_token:
            self.artefact_token = secrets.token_hex(16)

        if not self.consented_at:
            self.consented_at = now_datetime()


@frappe.whitelist(allow_guest=True)
def get_records():

    return frappe.get_all(
        "Consent Artefact",
        fields=[
            "name",
            "user_name",
            "purpose",
            "identity_type",
            "artefact_token",
            "consented_at",
            "ip_address",
            "status",
            "consent_request_id"
        ],
        order_by="modified desc",
        limit=100
    )
