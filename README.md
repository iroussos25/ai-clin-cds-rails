> 📊 **Note:** This repository is part of a **Comparative Engineering Study**. For the full performance benchmark, architectural breakdown, and deployment analysis, see the [Aegis Master Project](https://github.com/iroussos25/aegis-project).
---

# 🛡️ Aegis AI: Clinical Decision Support (CDS) Backend (Ruby on Rails)

### **Ruby on Rails 7 | PostgreSQL | ActiveJob | FHIR Synchronization**

Aegis AI (Rails Edition) is a robust, stateful backend designed to benchmark clinical data consistency and background synchronization in high-acuity environments. This implementation prioritizes long-term data integrity, persistent FHIR resource management, and server-side AI orchestration.

**[🌐 Portfolio](https://www.giannisroussos.com)** | **[💻 GitHub Profile](https://github.com/iroussos25)**

---

## 🩺 Clinical and Operational Context
Developed by a full-stack engineer with 10 years of experience as an **Active ICU/ER Nurse** and prior service as a **Platoon Leader in the Greek Special Forces (Paratroopers)**. This background drives the system's focus on clinical auditability and reliable data persistence—critical requirements for high-stakes medical decision support.

## 🎁 Recruiter & Interview Kit
Designed for rapid technical evaluation of backend architectural patterns:
* **Background Worker Transparency:** Demonstrated through the ingestion and flattening of complex FHIR resources via asynchronous jobs.
* **Database Schema Design:** A relational PostgreSQL approach to mapping non-linear clinical data into high-performance, queryable structures.
* **Audit Trail Logic:** Server-side logging that maps every AI inference to a specific `requestId` and clinical data timestamp.

## ⚙️ Core Technical Features

### 1. FHIR Persistence & Normalization Layer
Unlike stateless edge implementations, the Rails version utilizes a persistent database to manage the clinical lifecycle.
* **Data Flattening:** A dedicated service layer transforms nested FHIR JSON (Resources, Observations, Conditions) into optimized relational tables.
* **Asynchronous Sync:** Leverages **ActiveJob/Sidekiq** to ingest data from HAPI R4 servers without blocking the primary application thread.

### 2. Clinical Reasoning Engine (Server-Side)
The orchestration logic is handled via server-side service objects, allowing for more complex pre-processing of clinical context.
* **Protocol Enforcement:** System prompts are managed server-side to enforce strict adherence to clinical guardrails.
* **Contextual Grounding:** Efficiently queries the PostgreSQL backend to provide the LLM with a comprehensive, longitudinal patient history.

### 3. Source Attribution & XAI Audit
To meet healthcare transparency requirements, this project implements a persistent Explainable AI (XAI) path.
* **Insight-to-Source Mapping:** Every AI-generated suggestion is stored with a foreign key reference to the specific lab value or vital sign that triggered the reasoning.
* **Persistent Audit Path:** Enables retrospective review of AI performance against historical patient data.

---

## 🛡️ Security and Reliability
* **Data Integrity:** Strict PostgreSQL constraints and model-level validations ensure malformed clinical data is rejected at the database boundary.
* **Rate Limiting:** Server-side throttling to manage API consumption and protect against denial-of-service scenarios.
* **Error Handling:** Standardized clinical error reporting with detailed logging for system troubleshooting.

## 🏗️ Technical Architecture
* **Framework:** Ruby on Rails 7 (API-First)
* **Language:** Ruby 3.x
* **Database:** PostgreSQL (Optimized for clinical relational mapping)
* **Task Processing:** ActiveJob / Sidekiq for FHIR synchronization.
* **AI Integration:** Server-side orchestration via OpenAI/Gemini REST APIs.

---

## ⚖️ Proprietary Notice & Licensing
**License: All Rights Reserved**

The architectural patterns, database schemas, and synchronization logic are public for professional technical review. The core clinical reasoning prompts, specific mapping weights, and proprietary data-flattening algorithms are protected Intellectual Property.

*For recruitment or architectural inquiries: [grcodes@outlook.com](mailto:grcodes@outlook.com).*

---

## ⚡ Engineering Note
This platform was architected using a high-velocity AI-orchestration workflow. By leveraging Claude 3.5 Opus to accelerate boilerplate and service-layer logic, the project achieved a rapid pivot from concept to a fully persistent, synchronized backend.
