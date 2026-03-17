module Api
  class BenchmarkController < BaseController
    SYSTEM_PROMPT = Api::AnalyzeController::SYSTEM_PROMPT

    COST_PER_1M_INPUT  = 0.005
    COST_PER_1M_OUTPUT = 0.015

    def create
      runs_per_test = [[params[:runs_per_test].to_i, 1].max, 5].min
      scenarios = BenchmarkScenarios::SCENARIOS

      results = []

      scenarios.each_with_index do |scenario, idx|
        metrics = []
        hashes = []

        runs_per_test.times do |run_num|
          started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)

          begin
            prompt_content = "<clinical_document_context>\n[NOTE] Supplied clinical note\n#{scenario[:context]}\n</clinical_document_context>"
            prompt_content += "\n\n#{scenario[:question]}"

            service = GoogleTextService.new
            result = service.generate(
              system: SYSTEM_PROMPT,
              messages: [{ role: "user", content: prompt_content }]
            )

            elapsed_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started_at) * 1000).round
            response_text = result.text || ""
            input_tokens = estimate_tokens(scenario[:context] + scenario[:question])
            output_tokens = estimate_tokens(response_text)
            cost = (input_tokens * COST_PER_1M_INPUT + output_tokens * COST_PER_1M_OUTPUT) / 1_000_000.0

            citations = response_text.scan(/\[(?:NOTE|NOTE-CHUNK-\d+)\]/i).length

            metrics << {
              run: run_num + 1,
              model: result.model,
              latency_ms: elapsed_ms,
              input_tokens: input_tokens,
              output_tokens: output_tokens,
              total_tokens: input_tokens + output_tokens,
              cost: cost.round(6),
              citations: citations,
              response_length: response_text.length,
              success: true
            }

            hashes << string_hash(response_text)

            audit(route: "/api/benchmark", status: 200, started_at: Time.current - (elapsed_ms / 1000.0), model_used: result.model)
          rescue StandardError => e
            elapsed_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started_at) * 1000).round

            metrics << {
              run: run_num + 1,
              model: "unknown",
              latency_ms: elapsed_ms,
              input_tokens: 0,
              output_tokens: 0,
              total_tokens: 0,
              cost: 0,
              citations: 0,
              response_length: 0,
              success: false,
              error: e.message
            }
          end
        end

        successful = metrics.select { |m| m[:success] }

        # Consistency: % of runs with same response hash
        consistency = if hashes.length > 1
                        most_common = hashes.tally.max_by(&:last)&.first
                        ((hashes.count(most_common).to_f / hashes.length) * 100).round
                      else
                        100
                      end

        results << {
          test_id: scenario[:id],
          test_name: scenario[:name],
          description: scenario[:description],
          runs: metrics,
          avg_latency_ms: successful.any? ? (successful.sum { |m| m[:latency_ms] } / successful.length).round : 0,
          avg_tokens: successful.any? ? (successful.sum { |m| m[:total_tokens] } / successful.length).round : 0,
          avg_citations: successful.any? ? (successful.sum { |m| m[:citations] }.to_f / successful.length).round(1) : 0,
          total_cost: metrics.sum { |m| m[:cost] }.round(6),
          success_rate: metrics.any? ? ((successful.length.to_f / metrics.length) * 100).round : 0,
          consistency: consistency,
          model_summary: build_model_summary(metrics)
        }
      end

      # Aggregate summary
      all_successful = results.flat_map { |r| r[:runs] }.select { |m| m[:success] }

      summary = {
        total_runs: results.sum { |r| r[:runs].length },
        total_cost: results.sum { |r| r[:total_cost] }.round(6),
        avg_latency_ms: all_successful.any? ? (all_successful.sum { |m| m[:latency_ms] } / all_successful.length).round : 0,
        avg_consistency: results.any? ? (results.sum { |r| r[:consistency] }.to_f / results.length).round : 0,
        overall_success_rate: all_successful.length > 0 ? ((all_successful.length.to_f / results.flat_map { |r| r[:runs] }.length) * 100).round : 0
      }

      render_ok({ summary: summary, results: results })
    end

    private

    def estimate_tokens(text)
      (text.to_s.length / 4.0).ceil
    end

    def string_hash(str)
      hash = 0
      str.each_char do |c|
        hash = ((hash << 5) - hash + c.ord) & 0xFFFFFFFF
      end
      hash.to_s(36)
    end

    def build_model_summary(metrics)
      summary = {}
      metrics.each do |m|
        model = m[:model]
        summary[model] ||= { count: 0, avg_latency: 0, successes: 0 }
        summary[model][:count] += 1
        summary[model][:avg_latency] += m[:latency_ms]
        summary[model][:successes] += 1 if m[:success]
      end
      summary.transform_values do |v|
        {
          count: v[:count],
          avg_latency_ms: v[:count] > 0 ? (v[:avg_latency] / v[:count]).round : 0,
          success_rate: v[:count] > 0 ? ((v[:successes].to_f / v[:count]) * 100).round : 0
        }
      end
    end
  end
end
