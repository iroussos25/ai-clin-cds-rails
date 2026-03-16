class IndexDocumentJob < ApplicationJob
  queue_as :default

  def perform(doc_id:, context:, file_name: nil)
    # Remove old chunks for this doc
    DocumentChunk.where(doc_id: doc_id).delete_all

    chunker = ChunkingService.new
    embedder = EmbeddingService.new
    chunks = chunker.chunk(context)

    chunks.each_with_index do |chunk_text, index|
      embedding = embedder.embed(chunk_text)

      DocumentChunk.create!(
        doc_id: doc_id,
        chunk_index: index,
        content: chunk_text,
        embedding: embedding,
        metadata: {
          file_name: file_name,
          source_type: "upload",
          chunk_count: chunks.length
        }
      )
    end

    Rails.logger.info "[IndexDocumentJob] Indexed #{chunks.length} chunks for doc #{doc_id}"
  rescue EmbeddingService::EmbeddingError => e
    Rails.logger.error "[IndexDocumentJob] Embedding failed for doc #{doc_id}: #{e.message}"
    raise
  end
end
