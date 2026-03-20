# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin "pdf-lib", to: "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm"
pin_all_from "app/javascript/controllers", under: "controllers"
