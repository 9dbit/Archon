# frozen_string_literal: true

module Archon
  module Executor
    SUPPORTED_OPS = %w[CREATE_ROOM CREATE_WALL CREATE_DOOR CREATE_LABEL].freeze
    PLAN_SCHEMA = 'archon.sketchup-executor-plan.v1'.freeze
    REHEARSAL_PLAN_SCHEMA = 'archon.sketchup-executor-rehearsal-plan.v1'.freeze
    REQUIRED_NEXT_GATE = 'APPROVE_SKETCHUP_EXECUTOR'.freeze
    ATTRIBUTE_DICTIONARY = 'ARCHON'.freeze

    module_function

    def dry_run(plan)
      validate_plan!(plan)
      model = Sketchup.active_model
      raise 'ARCHON_EXECUTOR_MODEL_NOT_AVAILABLE' unless model

      operations = plan.fetch('operations')
      validate_operation_references!(operations)

      {
        'schema' => 'archon.sketchup-local-dry-run-report.v1',
        'state' => 'DRY_RUN_VERIFIED',
        'planFingerprint' => plan.fetch('deterministicFingerprint'),
        'packageHash' => plan.fetch('source').fetch('packageHash'),
        'model' => {
          'guid' => model.guid.to_s,
          'title' => model.title.to_s,
          'rootEntityCountBefore' => model.entities.length
        },
        'operationCount' => operations.length,
        'summary' => operation_summary(operations),
        'safety' => {
          'mutation' => 'none',
          'modelTransactionOpened' => false,
          'geometryMutationAttempted' => false,
          'executionEnabled' => false,
          'requiredNextGate' => REQUIRED_NEXT_GATE
        }
      }
    end

    def rollback_rehearsal(plan)
      validate_rehearsal_plan!(plan)
      model = Sketchup.active_model
      raise 'ARCHON_EXECUTOR_MODEL_NOT_AVAILABLE' unless model

      operations = plan.fetch('operations')
      validate_operation_references!(operations)

      root_before = model.entities.length
      transaction_open = false
      execution_error = nil
      rollback_error = nil
      materialized = nil

      begin
        started = model.start_operation('ARCHON Rollback Rehearsal', true)
        raise 'ARCHON_EXECUTOR_REHEARSAL_TRANSACTION_START_FAILED' unless started

        transaction_open = true
        rehearsal_group = model.entities.add_group
        rehearsal_group.name = '__ARCHON_ROLLBACK_REHEARSAL__'
        rehearsal_group.set_attribute(ATTRIBUTE_DICTIONARY, 'temporary', true)
        rehearsal_group.set_attribute(ATTRIBUTE_DICTIONARY, 'package_hash', plan.fetch('source').fetch('packageHash'))
        rehearsal_group.set_attribute(ATTRIBUTE_DICTIONARY, 'plan_fingerprint', plan.fetch('deterministicFingerprint'))

        materialized = materialize_operations!(rehearsal_group.entities, operations)
      rescue StandardError => error
        execution_error = error
      ensure
        if transaction_open
          begin
            model.abort_operation
          rescue StandardError => error
            rollback_error = error
          ensure
            transaction_open = false
          end
        end
      end

      root_after = model.entities.length
      unless root_after == root_before
        raise "ARCHON_EXECUTOR_ROLLBACK_VERIFY_FAILED:before=#{root_before}:after=#{root_after}"
      end
      raise "ARCHON_EXECUTOR_ROLLBACK_ABORT_FAILED:#{rollback_error.message}" if rollback_error
      raise execution_error if execution_error

      {
        'schema' => 'archon.sketchup-local-rollback-rehearsal-report.v1',
        'state' => 'ROLLBACK_VERIFIED',
        'planFingerprint' => plan.fetch('deterministicFingerprint'),
        'packageHash' => plan.fetch('source').fetch('packageHash'),
        'model' => {
          'guid' => model.guid.to_s,
          'title' => model.title.to_s,
          'rootEntityCountBefore' => root_before,
          'rootEntityCountAfter' => root_after
        },
        'operationCount' => operations.length,
        'summary' => operation_summary(operations),
        'materialized' => materialized,
        'safety' => {
          'mutation' => 'transient_rollback_only',
          'modelTransactionOpened' => true,
          'geometryMutationAttempted' => true,
          'transactionCommitted' => false,
          'transactionAborted' => true,
          'persistentGeometryChanged' => false,
          'executionEnabled' => false,
          'requiredNextGate' => REQUIRED_NEXT_GATE
        }
      }
    end

    def execute!(_plan)
      raise 'ARCHON_EXECUTOR_GATE_LOCKED'
    end

    def materialize_operations!(parent_entities, operations)
      counts = {
        'operationGroups' => 0,
        'rooms' => 0,
        'walls' => 0,
        'doors' => 0,
        'labels' => 0
      }

      operations.each do |operation|
        op_group = parent_entities.add_group
        op_group.name = "ARCHON #{operation.fetch('op')} #{operation.fetch('id')}"
        op_group.set_attribute(ATTRIBUTE_DICTIONARY, 'operation_id', operation.fetch('id').to_s)
        op_group.set_attribute(ATTRIBUTE_DICTIONARY, 'operation_type', operation.fetch('op').to_s)
        entities = op_group.entities

        case operation.fetch('op')
        when 'CREATE_ROOM'
          materialize_room!(entities, operation)
          counts['rooms'] += 1
        when 'CREATE_WALL'
          materialize_wall!(entities, operation)
          counts['walls'] += 1
        when 'CREATE_DOOR'
          materialize_door!(entities, operation)
          counts['doors'] += 1
        when 'CREATE_LABEL'
          materialize_label!(entities, operation)
          counts['labels'] += 1
        else
          raise "ARCHON_EXECUTOR_OPERATION_UNSUPPORTED:#{operation.fetch('op')}"
        end
        counts['operationGroups'] += 1
      end

      counts
    end

    def materialize_room!(entities, operation)
      origin = operation.fetch('originMm')
      width = positive_number!(operation.fetch('widthMm'), 'ROOM_WIDTH')
      depth = positive_number!(operation.fetch('depthMm'), 'ROOM_DEPTH')
      x = finite_number!(origin[0], 'ROOM_X')
      y = finite_number!(origin[1], 'ROOM_Y')
      z = finite_number!(origin[2], 'ROOM_Z')

      points = [
        point_mm(x, y, z),
        point_mm(x + width, y, z),
        point_mm(x + width, y + depth, z),
        point_mm(x, y + depth, z)
      ]
      add_closed_edges!(entities, points)
    end

    def materialize_wall!(entities, operation)
      start_mm = operation.fetch('startMm')
      finish_mm = operation.fetch('endMm')
      thickness = positive_number!(operation.fetch('thicknessMm'), 'WALL_THICKNESS')
      sx = finite_number!(start_mm[0], 'WALL_START_X')
      sy = finite_number!(start_mm[1], 'WALL_START_Y')
      sz = finite_number!(start_mm[2], 'WALL_START_Z')
      ex = finite_number!(finish_mm[0], 'WALL_END_X')
      ey = finite_number!(finish_mm[1], 'WALL_END_Y')
      ez = finite_number!(finish_mm[2], 'WALL_END_Z')
      raise 'ARCHON_EXECUTOR_WALL_Z_MISMATCH' unless (sz - ez).abs < 0.001

      dx = ex - sx
      dy = ey - sy
      length = Math.sqrt((dx * dx) + (dy * dy))
      raise 'ARCHON_EXECUTOR_WALL_ZERO_LENGTH' unless length.positive?

      half = thickness / 2.0
      offset_x = (-dy / length) * half
      offset_y = (dx / length) * half
      points = [
        point_mm(sx + offset_x, sy + offset_y, sz),
        point_mm(ex + offset_x, ey + offset_y, sz),
        point_mm(ex - offset_x, ey - offset_y, sz),
        point_mm(sx - offset_x, sy - offset_y, sz)
      ]
      add_closed_edges!(entities, points)
    end

    def materialize_door!(entities, operation)
      position = operation.fetch('positionMm')
      width = positive_number!(operation.fetch('widthMm'), 'DOOR_WIDTH')
      x = finite_number!(position[0], 'DOOR_X')
      y = finite_number!(position[1], 'DOOR_Y')
      z = finite_number!(position[2], 'DOOR_Z')
      half = width / 2.0

      points = if operation.fetch('orientation') == 'HORIZONTAL'
                 [point_mm(x - half, y, z), point_mm(x + half, y, z)]
               else
                 [point_mm(x, y - half, z), point_mm(x, y + half, z)]
               end
      entities.add_line(points[0], points[1])
    end

    def materialize_label!(entities, operation)
      position = operation.fetch('positionMm')
      point = point_mm(
        finite_number!(position[0], 'LABEL_X'),
        finite_number!(position[1], 'LABEL_Y'),
        finite_number!(position[2], 'LABEL_Z')
      )
      entities.add_text(operation.fetch('text').to_s, point)
    end

    def add_closed_edges!(entities, points)
      raise 'ARCHON_EXECUTOR_POLYGON_INVALID' unless points.is_a?(Array) && points.length >= 3

      points.each_with_index do |point, index|
        entities.add_line(point, points[(index + 1) % points.length])
      end
    end

    def point_mm(x, y, z)
      Geom::Point3d.new(x.to_f.mm, y.to_f.mm, z.to_f.mm)
    end

    def finite_number!(value, field)
      number = Float(value)
      raise "ARCHON_EXECUTOR_#{field}_INVALID" unless number.finite?

      number
    rescue ArgumentError, TypeError
      raise "ARCHON_EXECUTOR_#{field}_INVALID"
    end

    def positive_number!(value, field)
      number = finite_number!(value, field)
      raise "ARCHON_EXECUTOR_#{field}_INVALID" unless number.positive?

      number
    end

    def operation_summary(operations)
      {
        'createRoom' => operations.count { |operation| operation['op'] == 'CREATE_ROOM' },
        'createWall' => operations.count { |operation| operation['op'] == 'CREATE_WALL' },
        'createDoor' => operations.count { |operation| operation['op'] == 'CREATE_DOOR' },
        'createLabel' => operations.count { |operation| operation['op'] == 'CREATE_LABEL' }
      }
    end

    def validate_operation_references!(operations)
      ids = operations.map { |operation| operation.fetch('id').to_s }
      raise 'ARCHON_EXECUTOR_OPERATION_ID_DUPLICATE' unless ids.uniq.length == ids.length

      wall_ids = operations.select { |operation| operation['op'] == 'CREATE_WALL' }.map { |operation| operation['id'].to_s }
      room_ids = operations.select { |operation| operation['op'] == 'CREATE_ROOM' }.map { |operation| operation['roomId'].to_s }

      operations.each do |operation|
        op = operation['op'].to_s
        raise "ARCHON_EXECUTOR_OPERATION_UNSUPPORTED:#{op}" unless SUPPORTED_OPS.include?(op)

        if op == 'CREATE_DOOR'
          raise 'ARCHON_EXECUTOR_DOOR_HOST_WALL_UNRESOLVED' unless wall_ids.include?(operation['hostWallId'].to_s)
          raise 'ARCHON_EXECUTOR_DOOR_ROOM_UNRESOLVED' unless room_ids.include?(operation['roomId'].to_s)
        elsif op == 'CREATE_LABEL'
          raise 'ARCHON_EXECUTOR_LABEL_ROOM_UNRESOLVED' unless room_ids.include?(operation['roomId'].to_s)
        end
      end

      true
    end

    def validate_plan!(plan)
      raise 'ARCHON_EXECUTOR_PLAN_INVALID' unless plan.is_a?(Hash)
      raise 'ARCHON_EXECUTOR_PLAN_SCHEMA_INVALID' unless plan['schema'] == PLAN_SCHEMA
      raise 'ARCHON_EXECUTOR_PLAN_STATE_INVALID' unless plan['state'] == 'DRY_RUN_READY'
      raise 'ARCHON_EXECUTOR_PLAN_TARGET_INVALID' unless plan['targetEngine'] == 'SKETCHUP'
      raise 'ARCHON_EXECUTOR_PLAN_MODE_INVALID' unless plan['executionMode'] == 'NATIVE_2D_DRY_RUN'
      raise 'ARCHON_EXECUTOR_PLAN_UNITS_INVALID' unless plan['units'] == 'mm'

      validate_common_plan!(plan)
      safety = plan['safety']
      safe = safety['mutation'] == 'none' &&
        safety['dryRunOnly'] == true &&
        safety['sketchUpMutationEnabled'] == false &&
        safety['rubyExecutorCalled'] == false &&
        safety['transactionOpened'] == false &&
        safety['geometryMutationAllowed'] == false &&
        safety['requiredNextGate'] == REQUIRED_NEXT_GATE
      raise 'ARCHON_EXECUTOR_PLAN_SAFETY_CONTRACT_INVALID' unless safe

      true
    end

    def validate_rehearsal_plan!(plan)
      raise 'ARCHON_EXECUTOR_REHEARSAL_PLAN_INVALID' unless plan.is_a?(Hash)
      raise 'ARCHON_EXECUTOR_REHEARSAL_SCHEMA_INVALID' unless plan['schema'] == REHEARSAL_PLAN_SCHEMA
      raise 'ARCHON_EXECUTOR_REHEARSAL_STATE_INVALID' unless plan['state'] == 'ROLLBACK_REHEARSAL_READY'
      raise 'ARCHON_EXECUTOR_REHEARSAL_TARGET_INVALID' unless plan['targetEngine'] == 'SKETCHUP'
      raise 'ARCHON_EXECUTOR_REHEARSAL_MODE_INVALID' unless plan['executionMode'] == 'NATIVE_2D_ROLLBACK_REHEARSAL'
      raise 'ARCHON_EXECUTOR_REHEARSAL_UNITS_INVALID' unless plan['units'] == 'mm'

      validate_common_plan!(plan)
      safety = plan['safety']
      safe = safety['mutation'] == 'transient_rollback_only' &&
        safety['dryRunVerified'] == true &&
        safety['sketchUpMutationEnabled'] == false &&
        safety['transactionAllowed'] == true &&
        safety['transientGeometryAllowed'] == true &&
        safety['persistentGeometryAllowed'] == false &&
        safety['abortRequired'] == true &&
        safety['commitAllowed'] == false &&
        safety['saveAllowed'] == false &&
        safety['requiredNextGate'] == REQUIRED_NEXT_GATE
      raise 'ARCHON_EXECUTOR_REHEARSAL_SAFETY_CONTRACT_INVALID' unless safe

      true
    end

    def validate_common_plan!(plan)
      source = plan['source']
      safety = plan['safety']
      operations = plan['operations']
      raise 'ARCHON_EXECUTOR_PLAN_SOURCE_INVALID' unless source.is_a?(Hash)
      raise 'ARCHON_EXECUTOR_PLAN_SAFETY_INVALID' unless safety.is_a?(Hash)
      raise 'ARCHON_EXECUTOR_PLAN_OPERATIONS_INVALID' unless operations.is_a?(Array) && !operations.empty?
      raise 'ARCHON_EXECUTOR_PLAN_OPERATION_COUNT_MISMATCH' unless plan['operationCount'].to_i == operations.length
      raise 'ARCHON_EXECUTOR_PLAN_PACKAGE_HASH_INVALID' unless source['packageHash'].to_s.match?(/\A[a-f0-9]{64}\z/i)
      raise 'ARCHON_EXECUTOR_PLAN_FINGERPRINT_INVALID' unless plan['deterministicFingerprint'].to_s.match?(/\A[a-f0-9]{8,64}\z/i)

      true
    end
  end
end
