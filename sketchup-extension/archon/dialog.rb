# frozen_string_literal: true

require 'json'

module Archon
  module Dialog
    @dialog = nil
    @last_manifest = nil
    @last_layout_preview = nil

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
        width: 470,
        height: 820,
        min_width: 380,
        min_height: 560,
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

      dialog.add_action_callback('previewLayout') do |_context, prompt|
        begin
          clean_prompt = prompt.to_s.strip
          raise 'LAYOUT_PROMPT_REQUIRED' if clean_prompt.empty?

          set_status('Generating read-only layout candidates…')
          Archon::Client.preview_layout(clean_prompt) do |status, response|
            ok = status >= 200 && status < 300
            if ok
              @last_layout_preview = response
              dialog.execute_script("renderLayoutPreview(#{JSON.generate(response)});")
              set_status('Layout preview ready. No SketchUp geometry was changed.')
            else
              dialog.execute_script("renderLayoutPreview(#{JSON.generate(response)});")
              set_status("Layout preview failed (HTTP #{status}).", true)
            end
          end
        rescue StandardError => error
          set_status("Layout preview failed: #{escape_js(error.message)}", true)
        end
      end

      dialog.add_action_callback('analyze') do |_context|
        begin
          @last_manifest = Archon::Manifest.build
          dialog.execute_script("renderManifest(#{JSON.generate(@last_manifest)});")
          set_status('Read-only semantic analysis complete. No geometry was changed.')
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
            * { box-sizing: border-box; }
            body { margin: 0; background: #111315; color: #f3f5f7; }
            .wrap { padding: 18px; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            .sub { color: #9aa3ad; font-size: 12px; margin-bottom: 18px; }
            .card { background: #191c20; border: 1px solid #2b3138; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
            label { display: block; font-size: 11px; color: #aeb6bf; margin: 10px 0 5px; }
            input, textarea { width: 100%; background: #101215; color: #fff; border: 1px solid #343b44; border-radius: 8px; padding: 9px; font: inherit; }
            textarea { min-height: 96px; resize: vertical; line-height: 1.45; }
            button { width: 100%; border: 0; border-radius: 9px; padding: 10px 12px; margin-top: 9px; font-weight: 600; cursor: pointer; }
            .primary { background: #c8ff3d; color: #151914; }
            .secondary { background: #2a3037; color: #fff; }
            .disabled { opacity: .38; cursor: not-allowed; }
            pre { white-space: pre-wrap; word-break: break-word; max-height: 260px; overflow: auto; font-size: 11px; color: #c9d1d9; }
            #status { font-size: 12px; line-height: 1.4; color: #aeb6bf; }
            #status.error { color: #ff8a8a; }
            .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .metric { padding: 8px; background: #101215; border-radius: 8px; font-size: 11px; }
            .metric b { display: block; font-size: 16px; margin-top: 3px; }
            .note { margin-top: 10px; font-size: 11px; color: #9aa3ad; line-height: 1.45; }
            .program { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
            .room-chip { background: #101215; border-radius: 7px; padding: 7px; font-size: 10px; color: #c9d1d9; }
            .candidate { border: 1px solid #343b44; border-radius: 9px; margin-top: 10px; overflow: hidden; }
            .candidate-head { padding: 8px 10px; display: flex; justify-content: space-between; gap: 8px; font-size: 11px; }
            .candidate.valid .candidate-head { background: #20271a; }
            .candidate.invalid .candidate-head { background: #2a1b1b; }
            .plan { width: 100%; height: 180px; background: #0f1113; display: block; }
            .candidate-meta { padding: 8px 10px; color: #9aa3ad; font-size: 10px; line-height: 1.4; }
            .warning { color: #ffc36a; }
            .blocker { color: #ff8a8a; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <h1>ARCHON</h1>
            <div class="sub">SketchUp + LayOut Production Bridge · v#{Archon::EXTENSION_VERSION}</div>

            <div class="card">
              <strong>Prompt → Basic Layout</strong>
              <label>Describe the basic plan</label>
              <textarea id="layoutPrompt" placeholder="Buat kantor 12 x 20 meter untuk 20 staff, reception, 2 meeting room, director room, open office, pantry, toilet pria dan wanita. Corridor minimum 1.2 m. Dinding 100 mm."></textarea>
              <button class="primary" onclick="requestLayoutPreview()">Generate Layout Preview</button>
              <div class="note">Preview only. v0.3 does not draw or modify SketchUp geometry.</div>
              <div id="layoutProgram"></div>
              <div id="layoutCandidates"></div>
              <button class="disabled" disabled>Approve & Draw · locked in this slice</button>
            </div>

            <div class="card">
              <strong>Connection</strong>
              <label>ARCHON URL</label>
              <input id="baseUrl" placeholder="https://…">
              <label>Bridge token</label>
              <input id="token" type="password" placeholder="Enter token to replace saved token">
              <label>Project ID</label>
              <input id="projectId" placeholder="Optional for blank-model layout preview">
              <button class="secondary" onclick="saveConfig()">Save Connection</button>
            </div>

            <div class="card">
              <strong>Existing Model Analyzer</strong>
              <button class="secondary" onclick="sketchup.analyze()">Analyze Current Model</button>
              <button class="secondary" onclick="sketchup.sendManifest()">Send Manifest</button>
              <div id="metrics" class="row" style="margin-top:10px"></div>
              <div id="graphNote" class="note">Building Graph v2 preview appears after Send Manifest.</div>
            </div>

            <div class="card">
              <strong>Later stages</strong>
              <button class="disabled" disabled>Generate 3D White Model</button>
              <button class="disabled" disabled>Generate Drawings</button>
              <button class="disabled" disabled>Publish</button>
            </div>

            <div class="card"><div id="status">Ready. v0.3 preview path is read-only.</div></div>
            <div class="card"><strong>Raw response</strong><pre id="output">No request yet.</pre></div>
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
            function requestLayoutPreview() {
              const prompt = document.getElementById('layoutPrompt').value;
              if (!prompt.trim()) {
                setStatus('Enter a layout prompt first.', true);
                return;
              }
              sketchup.previewLayout(prompt);
            }
            function setStatus(message, isError) {
              const el = document.getElementById('status');
              el.textContent = message;
              el.className = isError ? 'error' : '';
            }
            function esc(value) {
              return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
            }
            function renderLayoutPreview(r) {
              document.getElementById('output').textContent = JSON.stringify(r, null, 2);
              if (!r || !r.program) return;
              const p = r.program;
              const footprint = p.footprint ? `${p.footprint.widthMm} × ${p.footprint.depthMm} mm · ${p.footprint.areaM2} m²` : 'Missing footprint';
              const rooms = (p.rooms || []).map(room => `<div class="room-chip">${esc(room.label)}<br>${room.targetWidthMm} × ${room.targetDepthMm} · ${room.targetAreaM2} m²</div>`).join('');
              const unresolved = (p.unresolved || []).map(item => `<div class="blocker">⚠ ${esc(item)}</div>`).join('');
              document.getElementById('layoutProgram').innerHTML = `<div class="note"><b>Program</b><br>${footprint}<br>Wall ${p.wallThicknessMm} mm · Corridor ≥ ${p.corridorMinMm} mm</div>${unresolved}<div class="program">${rooms}</div>`;
              document.getElementById('layoutCandidates').innerHTML = (r.candidates || []).map(candidateCard).join('');
            }
            function candidateCard(c) {
              const p = c.metrics || {};
              const findings = (c.findings || []).filter(f => f.severity !== 'PASS').map(f => `<div class="${f.severity === 'BLOCKER' ? 'blocker' : 'warning'}">${esc(f.message)}</div>`).join('');
              return `<div class="candidate ${c.valid ? 'valid' : 'invalid'}"><div class="candidate-head"><b>${esc(c.id)}</b><span>${c.valid ? 'VALID' : 'NEEDS REVIEW'}</span></div>${planSvg(c)}<div class="candidate-meta">${esc(c.strategy)} · rooms ${p.placedRoomAreaM2 || 0} m² / footprint ${p.footprintAreaM2 || 0} m²${findings}</div></div>`;
            }
            function planSvg(c) {
              const rooms = c.rooms || [];
              if (!rooms.length) return '<svg class="plan"></svg>';
              const maxX = Math.max(...rooms.map(r => r.xMm + r.widthMm), 1);
              const maxY = Math.max(...rooms.map(r => r.yMm + r.depthMm), 1);
              const margin = 10, w = 420, h = 180;
              const scale = Math.min((w - margin * 2) / maxX, (h - margin * 2) / maxY);
              const rects = rooms.map((r, i) => {
                const x = margin + r.xMm * scale;
                const y = margin + r.yMm * scale;
                const rw = Math.max(2, r.widthMm * scale);
                const rh = Math.max(2, r.depthMm * scale);
                return `<g><rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="none" stroke="#aeb6bf" stroke-width="1"/><text x="${x + 4}" y="${y + 12}" fill="#c8ff3d" font-size="9">${esc(r.roomId)}</text></g>`;
              }).join('');
              return `<svg class="plan" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${rects}</svg>`;
            }
            function renderManifest(m) {
              const s = m.summary || {};
              const metrics = [
                ['Root', s.root_entity_count || 0],
                ['Semantic', s.semantic_entity_count || 0],
                ['Faces', s.face_count || 0],
                ['Materials', s.material_count || 0]
              ];
              document.getElementById('metrics').innerHTML = metrics.map(x => `<div class="metric">${x[0]}<b>${x[1]}</b></div>`).join('');
              document.getElementById('graphNote').textContent = m.semantic_inventory_truncated
                ? 'Semantic inventory reached the safety limit and was truncated.'
                : 'Recursive semantic inventory ready. Send Manifest to create a read-only Building Graph v2 preview.';
              document.getElementById('output').textContent = JSON.stringify({ model: m.model, summary: m.summary, semantic_inventory_truncated: m.semantic_inventory_truncated, semantic_hash: m.semantic_hash }, null, 2);
            }
            function renderReceipt(r) {
              const g = r && r.buildingGraph;
              if (g && g.summary) {
                const s = g.summary;
                document.getElementById('graphNote').textContent = `Building Graph v2: ${s.classifiedCount}/${s.nodeCount} classified · ${s.unresolvedCount} unresolved · ${s.reviewRequiredCount} need review.`;
              }
              document.getElementById('output').textContent = JSON.stringify(r, null, 2);
            }
          </script>
        </body>
        </html>
      HTML
    end
  end
end
