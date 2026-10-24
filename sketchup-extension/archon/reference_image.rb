# frozen_string_literal: true

# Read-only concept planning bridge. This file intentionally contains no
# SketchUp geometry mutation calls. It never saves or modifies an .skp file.
require 'base64'
require 'json'

module Archon
  module ReferenceImage
    MAX_IMAGE_BYTES = 5 * 1024 * 1024
    MIME = {
      '.jpg' => 'image/jpeg',
      '.jpeg' => 'image/jpeg',
      '.png' => 'image/png',
      '.webp' => 'image/webp'
    }.freeze

    module_function

    def preview
      unless Archon::Config.configured?
        UI.messagebox('Configure ARCHON URL and bridge token in the ARCHON panel first.')
        return
      end

      url = Archon::Config.base_url
      unless url.start_with?('https://') || url.match?(/\Ahttp:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\z/)
        UI.messagebox('Reference images require HTTPS (except for a local test server).')
        return
      end

      path = UI.openpanel('Select a reference JPG, PNG or WebP', '', 'Images|*.jpg;*.jpeg;*.png;*.webp||')
      return unless path
      mime = MIME[File.extname(path).downcase]
      raise 'REFERENCE_IMAGE_UNSUPPORTED_TYPE' unless mime
      raise 'REFERENCE_IMAGE_FILE_NOT_FOUND' unless File.file?(path)
      raise 'REFERENCE_IMAGE_TOO_LARGE' unless File.size(path).between?(16, MAX_IMAGE_BYTES)

      values = UI.inputbox(
        ['Building width (metres)', 'Building depth (metres)', 'Project name'],
        [12.0, 16.0, 'Reference Concept'],
        'ARCHON Image to 3D: Concept Preview'
      )
      return unless values

      width = Float(values[0])
      depth = Float(values[1])
      project = values[2].to_s.strip
      raise 'WIDTH_MUST_BE_3_TO_50_M' unless width.finite? && width.between?(3, 50)
      raise 'DEPTH_MUST_BE_3_TO_50_M' unless depth.finite? && depth.between?(3, 50)
      raise 'PROJECT_NAME_INVALID' unless project.length.between?(1, 100)

      confirmation = UI.messagebox(
        'ARCHON will send the selected image to your configured cloud service and OpenAI for AI analysis. ' \
        'This is a conceptual massing estimate, not a measured model. ' \
        'No SketchUp geometry will be modified. Continue?',
        MB_YESNO
      )
      return unless confirmation == 6

      payload = {
        image: { mimeType: mime, base64: Base64.strict_encode64(File.binread(path)) },
        dimensions: { widthM: width, depthM: depth },
        projectName: project
      }
      endpoint = url + '/api/integrations/sketchup/reference-image/preview'
      Archon::Client.post_json(endpoint, payload) do |status, result|
        begin
          if status < 200 || status >= 300 || !result.is_a?(Hash) || result['state'] != 'REVIEW_REQUIRED'
            error = result.is_a?(Hash) ? result['error'].to_s : 'UNKNOWN_ERROR'
            UI.messagebox("ARCHON reference preview failed (HTTP #{status}): #{error}")
            next
          end
          plan = result.fetch('plan')
          raise 'PLAN_NOT_OBJECT' unless plan.is_a?(Hash)

          filename = project.gsub(/[^A-Za-z0-9_-]/, '_')[0, 60] + '_concept.json'
          destination = UI.savepanel('Save review-only concept JSON', File.dirname(path), filename)
          next unless destination

          if File.exist?(destination)
            UI.messagebox('Selected path already exists. Choose a different file; ARCHON never overwrites plans.')
            next
          end
          File.open(destination, 'wx') do |file|
            file.write(JSON.pretty_generate(plan))
            file.write("\n")
          end

          assumptions = (plan['assumptions'].is_a?(Array) ? plan['assumptions'] : []).length
          unknowns = (plan['unknowns'].is_a?(Array) ? plan['unknowns'] : []).length
          UI.messagebox(
            "Concept JSON saved for review.\n\n" \
            "Assumptions: #{assumptions}\n" \
            "Unknowns: #{unknowns}\n" \
            "No .skp geometry changed.\n" \
            "Native drawing remains behind ARCHON approval gates."
          )
        rescue StandardError => error
          UI.messagebox("ARCHON could not save the concept plan: #{error.message}")
        end
      end
    rescue StandardError => error
      UI.messagebox("ARCHON reference preview error: #{error.message}")
    end

    unless file_loaded?(__FILE__)
      UI.menu('Extensions').add_item('ARCHON Image to 3D Concept (Preview)') do
        Archon::ReferenceImage.preview
      end
      file_loaded(__FILE__)
    end
  end
end
