class DocumentChunk < ApplicationRecord
  # has_neighbors is only available when pgvector is installed.
  # Skip this entirely to avoid boot-time errors in non-pgvector environments.
  # At runtime, the match() method checks respond_to?(:nearest_neighbors) to handle both cases.

  validates :doc_id, presence: true
  validates :chunk_index, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :content, presence: true

  scope :for_doc, ->(doc_id) { where(doc_id: doc_id) }

  def self.match(query_embedding, match_count: 5, doc_id: nil)
    scope = doc_id.present? ? for_doc(doc_id) : all

    if scope.respond_to?(:nearest_neighbors)
      scope
        .nearest_neighbors(:embedding, query_embedding, distance: "cosine")
        .first(match_count)
        .map do |chunk|
          {
            id: chunk.id,
            doc_id: chunk.doc_id,
            chunk_index: chunk.chunk_index,
            content: chunk.content,
            metadata: chunk.metadata,
            similarity: 1.0 - chunk.neighbor_distance
          }
        end
    else
      scope.order(:chunk_index).limit(match_count).map do |chunk|
        {
          id: chunk.id,
          doc_id: chunk.doc_id,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          metadata: chunk.metadata,
          similarity: nil
        }
      end
    end
  end
end
