class PubmedService
  TIMEOUT_SECONDS = 25
  EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

  TOPIC_PATTERNS = [
    { pattern: /(sepsis|septic shock|lactate|vasopressor|hypotension|map|infection|cultures?)/i, terms: ["sepsis", "septic shock"] },
    { pattern: /(ards|acute respiratory distress|peep|fio2|ventilator|intubat|hypoxemia|trach)/i, terms: ["acute respiratory distress syndrome", "mechanical ventilation"] },
    { pattern: /(aki|acute kidney injury|creatinine|crrt|dialysis|oliguria|bun)/i, terms: ["acute kidney injury", "renal replacement therapy"] },
    { pattern: /(cardiogenic shock|ecmo|va-ecmo|iabp|dobutamine|milrinone|low output)/i, terms: ["cardiogenic shock", "extracorporeal membrane oxygenation"] },
    { pattern: /(delirium|encephalopathy|stroke|neurologic|cognitive)/i, terms: ["ICU delirium", "critical illness encephalopathy"] },
    { pattern: /(gi bleed|melena|erosive gastritis|transfusion|ischemic colitis)/i, terms: ["gastrointestinal bleeding", "critical illness"] }
  ].freeze

  Evidence = Data.define(:id, :title, :abstract_snippet, :journal, :published_at, :source_label, :source_url, :pmc_url)

  class PubmedError < StandardError; end

  def search(prompt:, context:, max_results: 4)
    query = build_query(prompt, context)
    pmids = search_pmids(query, max_results)
    return { query: query, evidence: [] } if pmids.empty?

    summaries = fetch_summaries(pmids)
    abstracts = fetch_abstracts(pmids)

    evidence = pmids.filter_map do |pmid|
      summary = summaries[pmid]
      abstract = abstracts[pmid]
      next unless summary && abstract.present?

      pmc_id = summary[:article_ids]&.find { |a| a[:idtype] == "pmc" }&.dig(:value)

      Evidence.new(
        id: pmid,
        title: summary[:title],
        abstract_snippet: abstract[0, 1800],
        journal: summary[:journal],
        published_at: summary[:pubdate],
        source_label: "PubMed",
        source_url: "https://pubmed.ncbi.nlm.nih.gov/#{pmid}/",
        pmc_url: pmc_id ? "https://pmc.ncbi.nlm.nih.gov/articles/#{pmc_id}/" : nil
      )
    end

    { query: query, evidence: evidence }
  end

  private

  def build_query(prompt, context)
    source_text = "#{prompt}\n#{context[0, 6000]}"
    topic_terms = Set.new

    TOPIC_PATTERNS.each do |entry|
      if entry[:pattern].match?(source_text)
        entry[:terms].each { |t| topic_terms.add(t) }
      end
    end

    if topic_terms.empty?
      topic_terms.add("critical care")
      topic_terms.add("intensive care")
    end

    intent_terms = build_intent_terms(prompt)
    topic_query = topic_terms.map { |t| %("#{t}") }.join(" OR ")
    intent_query = intent_terms.map { |t| %("#{t}") }.join(" OR ")

    "(#{topic_query}) AND (#{intent_query})"
  end

  def build_intent_terms(prompt)
    lowered = prompt.downcase
    if lowered.match?(/diagnos|concern|indicat|suggest/)
      ["diagnosis", "differential", "review"]
    elsif lowered.match?(/next step|management|consider|treatment|workup|evaluate/)
      ["guideline", "management", "review"]
    else
      ["guideline", "review"]
    end
  end

  def search_pmids(query, max_results)
    url = "#{EUTILS_BASE}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=#{max_results}&term=#{CGI.escape(query)}"
    data = fetch_json(url)
    data.dig("esearchresult", "idlist")&.select(&:present?) || []
  end

  def fetch_summaries(pmids)
    url = "#{EUTILS_BASE}/esummary.fcgi?db=pubmed&retmode=json&id=#{pmids.join(",")}"
    data = fetch_json(url)
    result = data["result"] || {}

    pmids.each_with_object({}) do |pmid, hash|
      record = result[pmid]
      next unless record.is_a?(Hash)

      hash[pmid] = {
        title: record["title"],
        journal: record["fulljournalname"],
        pubdate: record["pubdate"],
        article_ids: (record["articleids"] || []).map { |a| { idtype: a["idtype"], value: a["value"] } }
      }
    end
  end

  def fetch_abstracts(pmids)
    url = "#{EUTILS_BASE}/efetch.fcgi?db=pubmed&id=#{pmids.join(",")}&retmode=xml"
    xml = fetch_text(url)

    articles = xml.split("<PubmedArticle>").drop(1)
    articles.each_with_object({}) do |article, hash|
      pmid_match = article.match(/<PMID[^>]*>(.*?)<\/PMID>/)
      pmid = pmid_match ? strip_xml(pmid_match[1]) : nil
      next unless pmid.present?

      abstract_parts = article.scan(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/).map { |m| strip_xml(m[0]) }.select(&:present?)
      hash[pmid] = abstract_parts.join(" ") if abstract_parts.any?
    end
  end

  def strip_xml(input)
    input.gsub(/<[^>]+>/, " ")
         .gsub(/&lt;/, "<").gsub(/&gt;/, ">").gsub(/&amp;/, "&").gsub(/&quot;/, '"').gsub(/&#39;/, "'")
         .gsub(/\s+/, " ")
         .strip
  end

  def fetch_json(url)
    body = fetch_text(url)
    JSON.parse(body)
  end

  def fetch_text(url)
    uri = URI.parse(url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = TIMEOUT_SECONDS

    request = Net::HTTP::Get.new(uri.request_uri)
    request["Accept"] = "application/json"

    response = http.request(request)
    raise PubmedError, "PubMed request failed (#{response.code})" unless response.is_a?(Net::HTTPSuccess)

    response.body
  end
end
