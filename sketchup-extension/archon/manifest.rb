# frozen_string_literal: true

require 'json'
require 'digest'

module Archon
  module Manifest
    SCHEMA = 'archon.sketchup.manifest.v1'.freeze
    ARCHON_DICTIONARY = 'ARCHON'.freeze
    MAX_ENTITY_RECORDS = 5_000
    MAX_SEMANTIC_RECORDS = 12_000
    MAX_SEMANTIC_DEPTH = 12
    INCH_TO_MM = 25.4

    module_function

    def build(model = Sketchup.active_model)
      raise 'NO_ACTIVE_MODEL' unless model && model.valid?

      root_entities = model.entities.to_a
      entity_records = root_entities.first(MAX_ENTITY_RECORDS).map { |entity| entity_record(entity) }
      semantic = build_semantic_inventory(root_entities)

      manifest = {
        schema: SCHEMA,
        generated_at: Time.now.utc.iso8601,
        source: {
          application: 'SketchUp',
          sketchup_version: Sketchup.version,
          platform: Sketchup.platform.to_s,
          extension_version: Archon::EXTENSION_VERSION,
          capabilities: ['recursive_semantic_inventory_v1']
        },
        project_id: Archon::Config.project_id,
        model: {
          guid: model.guid,
          title: model.title.to_s,
          filename: safe_filename(model.path),
          modified: model.modified?,
          bounds_mm: bounds_mm(model.bounds),
          archon: dictionary_hash(model.attribute_dictionary(ARCHON_DICTIONARY, false))
        },
        summary: build_summary(model, root_entities, semantic[:records]),
        tags: model.layers.map { |layer| { name: layer.name.to_s, visible: layer.visible? } },
        materials: model.materials.map { |material| material_record(material) },
        scenes: model.pages.map { |page| scene_record(page) },
        definitions: model.definitions.reject(&:group?).map { |definition| definition_record(definition) },
        root_entities: entity_records,
        semantic_inventory: semantic[:records],
        semantic_inventory_truncated: semantic[:truncated],
        truncated: root_entities.length > MAX_ENTITY_RECORDS
      }

      manifest[:semantic_hash] = semantic_hash(manifest)
      manifest
    end

    def build_summary(model, entities, semantic_records = [])
      counts = Hash.new(0)
      entities.each { |entity| counts[entity.typename.to_s] += 1 }

      semantic_counts = Hash.new(0)
      semantic_records.each { |record| semantic_counts[record[:type].to_s] += 1 }

      {
        root_entity_count: entities.length,
        semantic_entity_count: semantic_records.length,
        face_count: model.number_faces,
        definition_count: model.definitions.length,
        material_count: model.materials.length,
        tag_count: model.layers.length,
        scene_count: model.pages.length,
        entity_types: counts.sort.to_h,
        semantic_entity_types: semantic_counts.sort.to_h
      }
    end

    def build_semantic_inventory(root_entities)
      records = []
      walk_semantic_entities(root_entities, records, 0, [], nil)
      {
        records: records,
        truncated: records.length >= MAX_SEMANTIC_RECORDS
      }
    rescue StandardError => error
      {
        records: [{
          persistent_id: nil,
          type: 'AnalysisError',
          name: nil,
          tag: nil,
          hidden: nil,
          locked: nil,
          bounds_mm: nil,
          archon: {},
          depth: 0,
          path: [],
          parent_persistent_id: nil,
          analysis_error: error.message
        }],
        truncated: false
      }
    end

    def walk_semantic_entities(entities, records, depth, parent_path, parent_persistent_id)
      return if depth > MAX_SEMANTIC_DEPTH || records.length >= MAX_SEMANTIC_RECORDS

      entities.each do |entity|
        break if records.length >= MAX_SEMANTIC_RECORDS
        next unless semantic_container?(entity)

        pid = persistent_id(entity)
        path_part = pid || "#{entity.typename}:#{records.length}"
        path = parent_path + [path_part]
        record = entity_record(entity).merge(
          parent_persistent_id: parent_persistent_id,
          depth: depth,
          path: path
        )
        records << record

        next if depth >= MAX_SEMANTIC_DEPTH

        children = semantic_children(entity)
        next unless children

        walk_semantic_entities(children, records, depth + 1, path, pid)
      end
    end

    def semantic_container?(entity)
      entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
    rescue StandardError
      false
    end

    def semantic_children(entity)
      if entity.is_a?(Sketchup::Group)
        entity.entities.to_a
      elsif entity.is_a?(Sketchup::ComponentInstance)
        entity.definition.entities.to_a
      end
    rescue StandardError
      nil
    end

    def entity_record(entity)
      record = {
        persistent_id: persistent_id(entity),
        type: entity.typename.to_s,
        name: entity_name(entity),
        tag: entity.respond_to?(:layer) && entity.layer ? entity.layer.name.to_s : nil,
        hidden: entity.respond_to?(:hidden?) ? entity.hidden? : nil,
        locked: entity.respond_to?(:locked?) ? entity.locked? : nil,
        bounds_mm: entity.respond_to?(:bounds) ? bounds_mm(entity.bounds) : nil,
        archon: dictionary_hash(entity.attribute_dictionary(ARCHON_DICTIONARY, false))
      }

      if entity.is_a?(Sketchup::Group)
        record[:definition] = entity.entities.parent.name.to_s if entity.entities.respond_to?(:parent)
        record[:child_entity_count] = entity.entities.length
      elsif entity.is_a?(Sketchup::ComponentInstance)
        record[:definition] = entity.definition.name.to_s
        record[:child_entity_count] = entity.definition.entities.length
      end

      record
    rescue StandardError => error
      {
        persistent_id: persistent_id(entity),
        type: entity.typename.to_s,
        analysis_error: error.message
      }
    end

    def definition_record(definition)
      {
        name: definition.name.to_s,
        instance_count: definition.instances.length,
        entity_count: definition.entities.length,
        bounds_mm: bounds_mm(definition.bounds),
        archon: dictionary_hash(definition.attribute_dictionary(ARCHON_DICTIONARY, false))
      }
    rescue StandardError => error
      { name: definition.name.to_s, analysis_error: error.message }
    end

    def material_record(material)
      {
        name: material.name.to_s,
        display_name: material.display_name.to_s,
        color: color_record(material.color),
        alpha: material.alpha,
        texture: material.texture ? File.basename(material.texture.filename.to_s) : nil,
        archon: dictionary_hash(material.attribute_dictionary(ARCHON_DICTIONARY, false))
      }
    rescue StandardError => error
      { name: material.name.to_s, analysis_error: error.message }
    end

    def scene_record(page)
      {
        name: page.name.to_s,
        description: page.description.to_s,
        transition_time: page.transition_time,
        delay_time: page.delay_time
      }
    rescue StandardError => error
      { name: page.name.to_s, analysis_error: error.message }
    end

    def persistent_id(entity)
      entity.respond_to?(:persistent_id) ? entity.persistent_id : nil
    rescue StandardError
      nil
    end

    def entity_name(entity)
      entity.respond_to?(:name) ? entity.name.to_s : nil
    rescue StandardError
      nil
    end

    def bounds_mm(bounds)
      return nil unless bounds && bounds.valid?

      min = bounds.min
      max = bounds.max
      {
        min: point_mm(min),
        max: point_mm(max),
        size: {
          x: round_mm(max.x.to_f - min.x.to_f),
          y: round_mm(max.y.to_f - min.y.to_f),
          z: round_mm(max.z.to_f - min.z.to_f)
        }
      }
    rescue StandardError
      nil
    end

    def point_mm(point)
      {
        x: round_mm(point.x.to_f),
        y: round_mm(point.y.to_f),
        z: round_mm(point.z.to_f)
      }
    end

    def round_mm(inches)
      (inches * INCH_TO_MM).round(3)
    end

    def color_record(color)
      return nil unless color

      { red: color.red, green: color.green, blue: color.blue, alpha: color.alpha }
    end

    def dictionary_hash(dictionary)
      return {} unless dictionary

      result = {}
      dictionary.each_pair { |key, value| result[key.to_s] = json_safe(value) }
      result
    rescue StandardError
      {}
    end

    def json_safe(value)
      case value
      when String, Integer, Float, TrueClass, FalseClass, NilClass
        value
      when Array
        value.map { |item| json_safe(item) }
      else
        value.to_s
      end
    end

    def safe_filename(path)
      path.to_s.empty? ? nil : File.basename(path.to_s)
    end

    def semantic_hash(manifest)
      copy = Marshal.load(Marshal.dump(manifest))
      copy.delete(:generated_at)
      copy.delete(:semantic_hash)
      Digest::SHA256.hexdigest(JSON.generate(deep_sort(copy)))
    end

    def deep_sort(value)
      case value
      when Hash
        value.keys.sort_by(&:to_s).each_with_object({}) do |key, sorted|
          sorted[key] = deep_sort(value[key])
        end
      when Array
        value.map { |item| deep_sort(item) }
      else
        value
      end
    end
  end
end
