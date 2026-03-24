> This repository is part of a comparative engineering study. 
> For the full project overview, architectural comparison, and 
> documentation, see the [Aegis Project monorepo](https://github.com/iroussos25/aegis-project).

# Aegis AI: Clinical Decision Support (Ruby on Rails)

The Rails implementation of the Aegis clinical AI platform. Focuses on 
stateful persistence, background job processing, and server-side AI 
orchestration with a persistent audit trail.

**[Live Demo](https://ai-clin-cds-rails.fly.dev/)**

## Quick start
```bash
cp .env.example .env
# Add Google AI API key and database credentials
bundle install
rails db:setup
bin/dev
```

## Tech stack

Ruby on Rails 7, Ruby 3.x, PostgreSQL, Hotwire (Turbo/Stimulus), 
ActiveJob, Sidekiq, Redis, Google Gemini/Gemma, HL7 FHIR R4, Fly.io
