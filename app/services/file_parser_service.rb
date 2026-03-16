class FileParserService
  TEXT_EXTENSIONS = %w[txt csv md xml json tsv hl7].to_set.freeze
  MAX_FILE_SIZE = 10.megabytes

  class ParseError < StandardError; end

  def parse(file)
    raise ParseError, "No file provided" unless file.present?
    raise ParseError, "File exceeds 10 MB limit" if file.size > MAX_FILE_SIZE

    ext = File.extname(file.original_filename).delete(".").downcase

    text = if ext == "pdf"
             parse_pdf(file)
           elsif TEXT_EXTENSIONS.include?(ext)
             file.read.force_encoding("UTF-8")
           else
             raise ParseError, "Unsupported file type: .#{ext}. Accepted: .pdf, .txt, .csv, .md, .xml, .json, .tsv, .hl7"
           end

    text = sanitize_text(text)
    raise ParseError, "File appears to be empty or could not be read" if text.blank?

    text
  end

  private

  def parse_pdf(file)
    reader = PDF::Reader.new(file.tempfile)
    reader.pages.map(&:text).join("\n")
  end

  def sanitize_text(text)
    text.gsub(/\0/, "")
        .gsub(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/, "")
        .gsub(/\n{4,}/, "\n\n\n")
        .strip
  end
end
