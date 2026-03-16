class CreateDocumentChunks < ActiveRecord::Migration[8.1]
  def change
    create_table :document_chunks, id: :uuid do |t|
      t.string :doc_id, null: false
      t.integer :chunk_index, null: false
      t.text :content, null: false
      t.vector :embedding, limit: 768, null: false
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :document_chunks, :doc_id
  end
end
