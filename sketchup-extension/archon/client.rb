# frozen_string_literal: true

require 'json'

module Archon
  module Client
    @requests = []

    module_function

    def send_manifest(manifest, &callback)
      post_json(Archon::Config.manifest_url, manifest, &callback)
    end

    def preview_layout(prompt, &callback)
      payload = {
        prompt: prompt.to_s,
        projectId: Archon::Config.project_id
      }
      post_json(Archon::Config.layout_preview_url, payload, &callback)
    end

    def post_json(url, payload, &callback)
      raise 'ARCHON_BRIDGE_NOT_CONFIGURED' unless Archon::Config.configured?

      request = Sketchup::Http::Request.new(url, Sketchup::Http::POST)
      request.headers = {
        'Content-Type' => 'application/json',
        'Accept' => 'application/json',
        'Authorization' => "Bearer #{Archon::Config.bridge_token}",
        'X-Archon-Client' => "sketchup/#{Archon::EXTENSION_VERSION}"
      }
      request.body = JSON.generate(payload)

      @requests << request
      request.start do |finished_request, response|
        @requests.delete(finished_request)
        parsed = parse_response(response)
        callback.call(response.status_code, parsed) if callback
      rescue StandardError => error
        callback.call(0, { 'error' => error.message }) if callback
      end
      true
    end

    def parse_response(response)
      body = response.body.to_s
      return {} if body.empty?

      JSON.parse(body)
    rescue JSON::ParserError
      { 'raw' => body }
    end
  end
end
