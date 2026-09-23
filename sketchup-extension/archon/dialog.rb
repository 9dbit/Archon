# frozen_string_literal: true

require 'json'

module Archon
  module Dialog
    @dialog = nil
    @last_manifest = nil

    module_function

    def show
      @dialog ||= build_dialog
      refresh_config
      @dialog.show
    end

    def build_dialog
      dialog = UI::HtmlDialog.new(
        dialog_title: 'ARCHON',
        preferences_key: 'ARCHON_PANEL',
        scrollable: true,
        resizable: true,
        width: 420,
        height: 650,
        min_width: 360,
        min_height: 480,
        style: UI::HtmlDialog::STYLE_DIALOG
      )

      dialog.set_html(html)

      dialog.add_action_callback('saveConfig') do |_context, base_url, token, project_id|
        Archon::Config.base_url = base_url
        Archon::Config.bridge_token = token
        Archon::Config.project_id = project_id
        refresh_config
        set_status('Configuration saved locally in SketchUp preferences.')
      end

      dialog.add_action_callback('analyze') do |_context|
        begin
          @last_manifest = Archon::Manifest.build
          dialog.execute_script("renderManifest(#{JSON.generate(@last_manifest)});")
          set_status('Read-only analysis complete. No geometry was changed.')
        rescue StandardError => error
          set_status("Analysis failed: #{escape_js(error.message)}", true)
        end
      end

      dialog.add_action_callback('sendManifest') do |_context|
        begin
          @last_manifest ||= Archon::Manifest.build
          set_status('Sending manifest to ARCHON…')
          Archon::Client.send_manifest(@last_manifest) do |status, response|
            ok = status >= 200 && status < 300
            message = ok ? "Manifest accepted (HTTP #{status})." : "Manifest rejected (HTTP #{status})."
            dialog.execute_script("renderReceipt(#{JSON.generate(response)});")
            set_status(message, !ok)
          end
        rescue StandardError => error
          set_status("Send failed: #{escape_js(error.message)}", true)
        end
      end

      dialog
    end

    def refresh_config
      return unless @dialog

      payload = {
        baseUrl: Archon::Config.base_url,
        tokenConfigured: !Archon::Config.bridge_token.empty?,
        projectId: Archon::Config.project_id
      }
      @dialog.execute_script("setConfig(#{JSON.generate(payload)});")
    end

    def set_status(message, error = false)
      return unless @dialog

      @dialog.execute_script("setStatus(#{JSON.generate(message.to_s)}, #{error ? 'true' : 'false'});")
    end

    def escape_js(value)
      value.to_s.gsub('\\', '\\\\').gsub('"', '\\"').gsub("\n", '\\n')
    end

    def html
      <<~HTML
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
            body { margin: 0; background: #111315; color: #f3f5f7; }
            .wrap { padding: 18px; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            .sub { color: #9aa3ad; font-size: 12px; margin-bottom: 18px; }
            .card { background: #191c20; border: 1px solid #2b3138; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
            label { display: block; font-size: 11px; color: #aeb6bf; margin: 10px 0 5px; }
            input { box-sizing: border-box; width: 100%; background: #101215; color: #fff; border: 1px solid #343b44; border-radius: 8px; padding: 9px; }
            button { width: 100%; border: 0; border-radius: 9px; padding: 10px 12px; margin-top: 9px; font-weight: 600; cursor: pointer; }
            .primary { background: #c8ff3d; color: #151914; }
            .secondary { background: #2a3037; color: #fff; }
            .disabled { opacity: .38; cursor: not-allowed; }
            pre { white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow: auto; font-size: 11px; color: #c9d1d9; }
            #status { font-size: 12px; line-height: 1.4; color: #aeb6bf; }
            #status.error { color: #ff8a8a; }
            .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .metric { padding: 8px; background: #101215; border-radius: 8px; font-size: 11px; }
            .metric b { display: block; font-size: 16px; margin-top: 3px; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <h1>ARCHON</h1>
            <div class="sub">SketchUp + LayOut Production Bridge · v#{Archon::EXTENSION_VERSION}</div>

            <div class="card">
              <strong>Connection</strong>
              <label>ARCHON URL</label>
              <input id="baseUrl" placeholder="https://…">
              <label>Bridge token</label>
              <input id="token" type="password" placeholder="Enter token to replace saved token">
              <label>Project ID</label>
              <input id="projectId" placeholder="Optional during first slice">
              <button class="secondary" onclick="saveConfig()">Save Connection</button>
            </div>

            <div class="card">
              <strong>Model Analyzer</strong>
              <button class="primary" onclick="sketchup.analyze()">Analyze Current Model</button>
              <button class="secondary" onclick="sketchup.sendManifest()">Send Manifest</button>
              <div id="metrics" class="row" style="margin-top:10px"></div>
            </div>

            <div class="card">
              <strong>Later stages</strong>
              <button class="disabled" disabled>Generate Drawings</button>
              <button class="disabled" disabled>Update Drawings</button>
              <button class="disabled" disabled>Publish</button>
            </div>

            <div class="card"><div id="status">Ready. First slice is read-only.</div></div>
            <div class="card"><strong>Receipt / manifest</strong><pre id="output">No analysis yet.</pre></div>
          </div>
          <script>
            let tokenConfigured = false;
            function setConfig(c) {
              document.getElementById('baseUrl').value = c.baseUrl || '';
              document.getElementById('projectId').value = c.projectId || '';
              tokenConfigured = !!c.tokenConfigured;
              document.getElementById('token').placeholder = tokenConfigured ? 'Saved token configured' : 'Bridge token required';
            }
            function saveConfig() {
              const token = document.getElementById('token').value;
              sketchup.saveConfig(
                document.getElementById('baseUrl').value,
                token || (tokenConfigured ? '__KEEP__' : ''),
                document.getElementById('projectId').value
              );
            }
            function setStatus(message, isError) {
              const el = document.getElementById('status');
              el.textContent = message;
              el.className = isError ? 'error' : '';
            }
            function renderManifest(m) {
              const s = m.summary || {};
              const metrics = [
                ['Entities', s.root_entity_count || 0],
                ['Faces', s.face_count || 0],
                ['Materials', s.material_count || 0],
                ['Scenes', s.scene_count || 0]
              ];
              document.getElementById('metrics').innerHTML = metrics.map(x => `<div class="metric">${x[0]}<b>${x[1]}</b></div>`).join('');
              document.getElementById('output').textContent = JSON.stringify({ model: m.model, summary: m.summary, semantic_hash: m.semantic_hash }, null, 2);
            }
            function renderReceipt(r) {
              document.getElementById('output').textContent = JSON.stringify(r, null, 2);
            }
          </script>
        </body>
        </html>
      HTML
    end
  end
end
