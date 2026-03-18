require "test_helper"

class Api::Ops::CiStatusControllerTest < ActionDispatch::IntegrationTest
  test "returns CI status payload" do
    fake_snapshot = {
      status: "ok",
      provider: "github_actions",
      branch: "master",
      conclusion: "success",
      run_updated_at: "2026-03-18T00:00:00Z",
      run_url: "https://github.com/example/repo/actions/runs/1"
    }

    CiStatusService.stub(:snapshot, fake_snapshot) do
      get "/api/ops/ci_status"
    end

    assert_response :success
    json = JSON.parse(response.body)

    assert_equal "ok", json["status"]
    assert_equal "github_actions", json["provider"]
    assert_equal "success", json["conclusion"]
  end
end
