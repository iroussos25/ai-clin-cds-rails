class AnalysisChannel < ApplicationCable::Channel
  def subscribed
    stream_from "analysis_#{params[:session_id]}"
  end

  def unsubscribed
    # Cleanup if needed
  end
end
