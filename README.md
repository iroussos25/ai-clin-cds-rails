# 🏥 Clinical Decision Support (CDS) | Rails 8 AI Engine

A high-performance system designed to ingest raw clinical data and provide stateful, AI-augmented triage summaries. Built to solve the "Time-to-Insight" problem in high-pressure environments (ICU/ER).

### 🚀 Live Links
* **Live App:** [https://ai-clin-cds-rails.fly.dev/](https://ai-clin-cds-rails.fly.dev/)
* **Portfolio:** [www.giannisroussos.com](http://www.giannisroussos.com)
* **GitHub:** [https://github.com/iroussos25/ai-clin-cds-rails](https://github.com/iroussos25/ai-clin-cds-rails)

---

## 🛠️ The Stack & Architecture

* **Backend:** Ruby on Rails 8.0.1
* **Database:** PostgreSQL (utilizing `jsonb` for flexible clinical vitals)
* **Frontend:** Tailwind CSS / Hotwire (Turbo & Stimulus)
* **AI Orchestration:** OpenAI API via decoupled Service Objects
* **Deployment:** Fly.io via Kamal & GitHub Actions (CI/CD)

### Key Technical Decisions
1. **The Move to Rails 8:** Migrated from a Next.js/Node stack to Rails 8 in under 48 hours. Used the "One-Person Framework" philosophy to consolidate Auth, DB management, and Asset pipelines.
2. **Data Persistence:** Unlike ephemeral LLM chat apps, this uses **ActiveRecord** to maintain a durable clinical history for every patient.
3. **Service Object Pattern:** AI logic is isolated in `app/services/clinical_ai_agent.rb`. This decouples the "thinking" from the controllers, making the app provider-agnostic and easier to test.
4. **CI/CD Pipeline:** Automated testing and deployment via GitHub Actions. Every push to `main` is validated and deployed to the Fly.io edge.

---

## 🏗️ Local Development

### Prerequisites
* Ruby 3.2+
* PostgreSQL
* Redis (for Rails 8 Solid Cache/Queue)
* OpenAI API Key

### Setup Instructions
1. **Clone the repo:**
   ```bash
   git clone [https://github.com/iroussos25/ai-clin-cds-rails.git](https://github.com/iroussos25/ai-clin-cds-rails.git)
   cd ai-clin-cds-rails
