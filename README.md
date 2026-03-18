# 🏥 Clinical Decision Support (CDS) | AI Context Engine

**An "Operational Grounding" approach to AI-assisted Triage.** Built by a former **ICU/ER Nurse (Kaiser Alum)** and **Special Forces Platoon Leader** transitioning into Software Engineering. This isn't a chatbot; it's a persistent, stateful clinical memory engine built for the high-pressure reality of the clinical floor.

## ⚡ Live Demo & Architecture
* **Live Application:** [https://ai-clin-cds-rails.fly.dev/](https://ai-clin-cds-rails.fly.dev/)
* **Primary Stack:** Rails 8, PostgreSQL (JSONB), Tailwind CSS, OpenAI API.
* **Infrastructure:** Deployed on **Fly.io** using **Kamal** and **GitHub Actions** for CI/CD.

---

## 🏗️ The Problem: "Data Graveyards" vs. "Time-to-Insight"
In environments like the ICU or high-volume care teams (like **Pair Team**), Electronic Health Records (EHRs) are often data-heavy but insight-poor. Clinicians lose critical minutes digging through tabs to build a mental model of a patient.

**The Solution:** This engine ingests raw clinical data and orchestrates AI agents to maintain a persistent "Clinical Context Window," providing real-time, actionable triage summaries and severity scoring.

---

## 🛠️ Engineering for "Mission Intensity"

### 1. Rails 8 / Modern Asset Pipeline
Migrated from a Next.js/Node stack to **Rails 8** in <48 hours to leverage the "One-Person Framework" philosophy. Used **Propshaft** and **Tailwind** for a high-density, terminal-inspired UI that mimics professional clinical monitors.

### 2. Service Object Pattern (AI Orchestration)
OpenAI integration is decoupled into a dedicated `ClinicalAIAgent` service. This ensures the core business logic is LLM-agnostic and maintains a clean separation of concerns between the controller and the AI's "thought process."

### 3. Stateful Persistence (ActiveRecord)
Unlike ephemeral chat interfaces, this system uses **PostgreSQL** to maintain a durable history of patient vitals and AI-generated assessments. This provides a "Clinical Memory" that is auditable and consistent across shifts.

### 4. Hardened CI/CD
Configured a robust **GitHub Actions** pipeline to handle automated testing and deployment to the Fly.io edge. Every commit is production-ready, reflecting a "No-BS" approach to software reliability.

---

## 🪖 About the Builder: Giannis Roussos
I don't build "toys." I build tools that survive contact with reality.
* **Clinical:** 10 years as an ICU/ER Nurse (Kaiser Permanente).
* **Operational:** Platoon Leader, Greek Special Forces (Paratroopers).
* **Technical:** Full-stack builder specializing in AI orchestration (React, Next.js, Node, Rails 8, AWS).

*“
