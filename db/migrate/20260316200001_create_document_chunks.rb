class CreateDocumentChunks < ActiveRecord::Migration[8.1]
  def change
    vector_available = connection.adapter_name == "PostgreSQL" &&
      select_value("SELECT 1 FROM pg_available_extensions WHERE name = 'vector' LIMIT 1")

    create_table :document_chunks, id: :uuid do |t|
      t.string :doc_id, null: false
      t.integer :chunk_index, null: false
      t.text :content, null: false
      if vector_available
        t.vector :embedding, limit: 768, null: false
      else
        t.jsonb :embedding, default: [], null: false
      end
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :document_chunks, :doc_id
  end
end
