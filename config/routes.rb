Rails.application.routes.draw do
  # Main workbench (single-page app with Turbo Frames)
  root "workbench#index"
  get "workbench", to: "workbench#index"

  # API namespace for all backend endpoints
  namespace :api do
    post "analyze", to: "analyze#create"
    post "clinical_review", to: "clinical_review#create"
    post "upload", to: "upload#create"

    # Retrieval (RAG) endpoints
    post "retrieval/index", to: "retrieval#index_document"
    post "retrieval/query", to: "retrieval#query"

    # PubMed literature search
    post "pubmed/search", to: "pubmed#search"

    # Observability
    namespace :ops do
      get "metrics", to: "metrics#show"
    end
  end

  # Health check
  get "up" => "rails/health#show", as: :rails_health_check
end
