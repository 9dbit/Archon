# frozen_string_literal: true

module Archon
  module Config
    PREF_KEY = 'ARCHON'.freeze
    DEFAULT_BASE_URL = 'https://archon-web-production-0305.up.railway.app'.freeze

    module_function

    def base_url
      normalize_base_url(Sketchup.read_default(PREF_KEY, 'base_url', DEFAULT_BASE_URL).to_s)
    end

    def base_url=(value)
      Sketchup.write_default(PREF_KEY, 'base_url', normalize_base_url(value.to_s))
    end

    def bridge_token
      Sketchup.read_default(PREF_KEY, 'bridge_token', '').to_s
    end

    def bridge_token=(value)
      Sketchup.write_default(PREF_KEY, 'bridge_token', value.to_s.strip)
    end

    def project_id
      Sketchup.read_default(PREF_KEY, 'project_id', '').to_s
    end

    def project_id=(value)
      Sketchup.write_default(PREF_KEY, 'project_id', value.to_s.strip)
    end

    def configured?
      !base_url.empty? && !bridge_token.empty?
    end

    def manifest_url
      "#{base_url}/api/integrations/sketchup/manifest"
    end

    def normalize_base_url(value)
      value.strip.sub(%r{/+\z}, '')
    end
  end
end
