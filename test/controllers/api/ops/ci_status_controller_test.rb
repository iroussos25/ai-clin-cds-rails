require "test_helper"

class Api::Ops::CiStatusControllerTest < ActionDispatch::IntegrationTest
  test "returns ci status payload shape" do
    get "/api/ops/ci_status"

    assert_response :success
    json = JSON.parse(response.body)

    assert_includes ["ok", "unavailable"], json["status"]
    assert_equal "github_actions", json["provider"]
  end
end
