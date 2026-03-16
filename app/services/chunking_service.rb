class ChunkingService
  DEFAULT_CHUNK_SIZE = 1200
  DEFAULT_OVERLAP = 220

  def initialize(chunk_size: DEFAULT_CHUNK_SIZE, overlap: DEFAULT_OVERLAP)
    @chunk_size = chunk_size
    @overlap = overlap
  end

  def chunk(text)
    input = text.strip
    return [] if input.blank?

    chunks = []
    start = 0

    while start < input.length
      finish = [input.length, start + @chunk_size].min
      chunk = input[start...finish].strip
      chunks << chunk if chunk.present?
      break if finish >= input.length

      start = [0, finish - @overlap].max
    end

    chunks
  end
end
