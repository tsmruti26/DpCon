# DPDP Consent Management Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Frappe](https://img.shields.io/badge/Frappe-0089FF?logo=frappe&logoColor=white)](https://frappeframework.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![REST API](https://img.shields.io/badge/REST-API-009688?logo=fastapi&logoColor=white)](https://restfulapi.net)

## 🎯 Overview

A **production-ready consent management system** for India's DPDP Act compliance. Built for:

- **Network Engineers**: REST APIs, stateless architecture, horizontal scaling
- **CRM Managers**: Consent lifecycle, audit trails, compliance reporting  
- **Developers**: Clean Frappe architecture, whitelisted methods

## 🌐 Network-Ready Architecture

| Feature | Implementation | Value |
|---------|---------------|-------|
| RESTful API | Whitelisted methods with CSRF | Load balancer ready |
| State Tokens | 32-char randomized per session | Request tracing |
| Stateless | Session-less design | Horizontally scalable |
| Database | MariaDB with connection pooling | 1000+ concurrent requests |

## 📊 CRM & Business Features

| Stage | Action | Benefit |
|-------|--------|---------|
| Submission | Auto-generates Consent ID | Single source of truth |
| Tracking | Timeline + approval status | Audit-ready |
| Dashboard | Real-time statistics | Business intelligence |
| Retention | Expiry dates | DPDP compliance |

## 🔧 API Endpoint

```http
GET /api/method/dpdp_consent.dpdp_consent.doctype.consent_request.consent_request.get_consent_records
