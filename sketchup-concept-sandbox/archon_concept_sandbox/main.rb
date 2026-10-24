# frozen_string_literal: true
require 'sketchup.rb'
require 'json'

# Opt-in local sandbox. This is NOT the governed ARCHON production executor.
module ArchonConceptSandbox
  module Main
    module_function

    def limited_number(value, key, min, max)
      raise ArgumentError, "#{key}: not finite" unless value.is_a?(Numeric) && value.finite?
      raise ArgumentError, "#{key}: outside #{min}..#{max}" unless value.between?(min, max)
      value.to_f
    end

    def validate(plan)
      raise ArgumentError, 'Invalid schema' unless plan.is_a?(Hash) && plan['version'] == '0.1' && plan['units'] == 'm'
      b, f, colors = plan.fetch('building'), plan.fetch('facade'), plan.fetch('materials')
      raise ArgumentError, 'Invalid plan objects' unless b.is_a?(Hash) && f.is_a?(Hash) && colors.is_a?(Hash)
      raise ArgumentError, 'Invalid name' unless plan['project_name'].is_a?(String) && plan['project_name'].strip.length.between?(1, 100)
      width = limited_number(b.fetch('width'), 'width', 3, 50)
      limited_number(b.fetch('depth'), 'depth', 3, 50)
      raise ArgumentError, 'Invalid floors' unless b.fetch('floors').is_a?(Integer) && b.fetch('floors').between?(1, 4)
      limited_number(b.fetch('floor_height'), 'height', 2.5, 5)
      wall = limited_number(b.fetch('wall_thickness'), 'wall', 0.12, 0.5)
      limited_number(b.fetch('roof_overhang'), 'overhang', 0, 1.5)
      raise ArgumentError, 'Only flat roof supported' unless b['roof_type'] == 'flat'
      ratio = limited_number(f.fetch('glazing_ratio'), 'glazing', 0.2, 0.85)
      raise ArgumentError, 'Piers too narrow' unless width * (1 - ratio) / 2 > wall + 0.05
      raise ArgumentError, 'Invalid balcony' unless [true, false].include?(f.fetch('balcony'))
      limited_number(f.fetch('balcony_depth'), 'balcony_depth', 0.6, 2.4)
      raise ArgumentError, 'Invalid fins' unless f.fetch('vertical_fins').is_a?(Integer) && f.fetch('vertical_fins').between?(0, 20)
      %w[walls slab roof glass timber].each do |key|
        raise ArgumentError, "Invalid #{key} color" unless colors.fetch(key).match?(/\A#[a-fA-F0-9]{6}\z/)
      end
      %w[assumptions unknowns].each do |key|
        a = plan.fetch(key)
        raise ArgumentError, "Invalid #{key}" unless a.is_a?(Array) && a.length <= 20 && a.all? { |s| s.is_a?(String) && s.length <= 500 }
      end
      true
    end

    def check_blank!(model)
      raise 'No active model' unless model && model.valid?
      raise 'SANDBOX_ONLY_UNSAVED_MODEL' unless model.path.to_s.empty?
      raise 'SANDBOX_ONLY_EMPTY_MODEL' unless model.entities.length.zero?
    end

    def material(model, name, hex, alpha = 1.0)
      mat = model.materials["ARCHON Concept #{name}"] || model.materials.add("ARCHON Concept #{name}")
      mat.color = Sketchup::Color.new(hex[1, 2].to_i(16), hex[3, 2].to_i(16), hex[5, 2].to_i(16))
      mat.alpha = alpha
      mat
    end

    def box(entities, name, x, y, z, w, d, h, mat)
      raise ArgumentError, 'Negative box dimension' unless [w, d, h].all? { |v| v > 0 }
      group = entities.add_group
      group.name = name
      points = [[x.m, y.m, z.m], [(x + w).m, y.m, z.m],
                [(x + w).m, (y + d).m, z.m], [x.m, (y + d).m, z.m]]
      face = group.entities.add_face(points)
      raise 'Could not create face' unless face
      face.reverse! if face.normal.z < 0
      face.pushpull(h.m)
      group.entities.grep(Sketchup::Face).each do |surface|
        surface.material = mat
        surface.back_material = mat
      end
      group
    end

    def generate!(plan)
      validate(plan)
      model = Sketchup.active_model
      check_blank!(model)
      b, f = plan.fetch('building'), plan.fetch('facade')
      w, d, n = b.fetch('width').to_f, b.fetch('depth').to_f, b.fetch('floors')
      h, t = b.fetch('floor_height').to_f, b.fetch('wall_thickness').to_f
      open_w = w * f.fetch('glazing_ratio').to_f
      pier = (w - open_w) / 2
      slab = 0.22
      model.start_operation('ARCHON Concept Sandbox: Generate', true)
      begin
        materials = {}
        plan.fetch('materials').each do |key, color|
          materials[key] = material(model, key, color, key == 'glass' ? 0.36 : 1.0)
        end
        root = model.entities.add_group
        root.name = "ARCHON Concept | #{plan['project_name']}"
        root.set_attribute('archon_concept', 'source_plan', JSON.generate(plan))
        root.set_attribute('archon_concept', 'concept_only', true)
        ents = root.entities
        n.times do |floor|
          base = floor * h
          z = base + slab
          wall_h = h - slab
          pfx = "L#{floor + 1}"
          box(ents, "#{pfx} slab", 0, 0, base, w, d, slab, materials.fetch('slab'))
          box(ents, "#{pfx} left", 0, 0, z, t, d, wall_h, materials.fetch('walls'))
          box(ents, "#{pfx} right", w - t, 0, z, t, d, wall_h, materials.fetch('walls'))
          box(ents, "#{pfx} rear", t, d - t, z, w - 2 * t, t, wall_h, materials.fetch('walls'))
          box(ents, "#{pfx} front left", t, 0, z, pier - t, t, wall_h, materials.fetch('walls'))
          box(ents, "#{pfx} front right", w - pier, 0, z, pier - t, t, wall_h, materials.fetch('walls'))
          box(ents, "#{pfx} sill", pier, 0, z, open_w, t, 0.5, materials.fetch('walls'))
          box(ents, "#{pfx} lintel", pier, 0, z + wall_h - 0.42, open_w, t, 0.42, materials.fetch('walls'))
          box(ents, "#{pfx} glass", pier + 0.05, -0.035, z + 0.56,
              open_w - 0.1, 0.025, wall_h - 1.04, materials.fetch('glass'))
          if floor == 1 && f.fetch('balcony')
            bd = f.fetch('balcony_depth').to_f
            box(ents, 'Balcony slab', pier, -bd, base + 0.03, open_w * 0.6, bd + 0.2, 0.14, materials.fetch('slab'))
            box(ents, 'Balcony rail', pier, -bd, base + 0.17, open_w * 0.6, 0.045, 0.94, materials.fetch('glass'))
          end
          fins = f.fetch('vertical_fins')
          fins.times do |j|
            x = pier + (j + 1).to_f * open_w / (fins + 1)
            box(ents, "#{pfx} fin #{j + 1}", x, -0.18, z + 0.1, 0.055, 0.12, wall_h - 0.2, materials.fetch('timber'))
          end
        end
        o = b.fetch('roof_overhang').to_f
        box(ents, 'Roof', -o, -o, n * h, w + 2 * o, d + 2 * o, 0.23, materials.fetch('roof'))
        model.commit_operation
        model.active_view.zoom_extents
      rescue StandardError
        model.abort_operation
        raise
      end
    end

    def import(path)
      raise 'Invalid JSON file' unless File.file?(path) && File.extname(path).downcase == '.json'
      raise 'Plan size out of range' unless File.size(path).between?(1, 1024 * 1024)
      plan = JSON.parse(File.read(path, encoding: 'UTF-8'))
      validate(plan)
      check_blank!(Sketchup.active_model)
      response = UI.messagebox(
        "Create conceptual 3D geometry in this BLANK and UNSAVED model?\n" \
        "Project: #{plan.fetch('project_name')}\n" \
        "No existing model changes or automatic saving. Undo is available.",
        MB_YESNO
      )
      return unless response == 6
      generate!(plan)
      UI.messagebox('Editable model created. Inspect and save the .skp manually.')
    rescue StandardError => e
      UI.messagebox("ARCHON Concept Sandbox: #{e.message}")
      warn(e.full_message)
    end

    unless file_loaded?(__FILE__)
      menu = UI.menu('Extensions').add_submenu('ARCHON Concept Sandbox')
      menu.add_item('Import reviewed concept JSON') do
        path = UI.openpanel('Select a reviewed concept plan', '', 'JSON|*.json||')
        import(path) if path
      end
      menu.add_item('Generate sample villa') { import(File.join(__dir__, 'sample_plan.json')) }
      file_loaded(__FILE__)
    end
  end
end
