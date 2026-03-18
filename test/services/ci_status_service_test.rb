require "test_helper"

class CiStatusServiceTest < ActiveSupport::TestCase
  test "returns unavailable when repository is not configured" do
    with_env("GITHUB_REPOSITORY" => nil) do
      result = CiStatusService.snapshot

      assert_equal "unavailable", result[:status]
      assert_match(/Missing GITHUB_REPOSITORY/, result[:message])
    end
  end

  private

  def with_env(new_values)
    old_values = {}
    new_values.each_key { |key| old_values[key] = ENV[key] }
    new_values.each { |key, value| ENV[key] = value }
    yield
  ensure
    old_values.each { |key, value| ENV[key] = value }
  end
end
