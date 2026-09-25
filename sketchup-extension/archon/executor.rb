# frozen_string_literal: true

module Archon
  module Executor
    SUPPORTED_OPS = %w[CREATE_ROOM CREATE_WALL CREATE_DOOR CREATE_LABEL].freeze
    PLAN_SCHEMA = 'archon.sketchup-executor-plan.v1'.freeze
    REQUIRED_NEXT_GATE = 'APPROVE_SKETCHUP_EXECUTOR'.freeze

    module_function

    def dry_run(plan)
      validate_plan!(plan)
      model = Sketchup.active_model
      raise 'ARCHON_EXECUTOR_MODEL_NOT_AVAILABLE' unless model

      operations = plan.fetch('operations')
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
        'summary' => {
          'createRoom' => operations.count { |operation| operation['op'] == 'CREATE_ROOM' },
          'createWall' => operations.count { |operation| operation['op'] == 'CREATE_WALL' },
          'createDoor' => operations.count { |operation| operation['op'] == 'CREATE_DOOR' },
          'createLabel' => operations.count { |operation| operation['op'] == 'CREATE_LABEL' }
        },
        'safety' => {
          'mutation' => 'none',
          'modelTransactionOpened' => false,
          'geometryMutationAttempted' => false,
          'executionEnabled' => false,
          'requiredNextGate' => REQUIRED_NEXT_GATE
        }
      }
    end

    def execute!(_plan)
      raise 'ARCHON_EXECUTOR_GATE_LOCKED'
    end

    def validate_plan!(plan)
      raise 'ARCHON_EXECUTOR_PLAN_INVALID' unless plan.is_a?(Hash)
      raise 'ARCHON_EXECUTOR_PLAN_SCHEMA_INVALID' unless plan['schema'] == PLAN_SCHEMA
      raise 'ARCHON_EXECUTOR_PLAN_STATE_INVALID' unless plan['state'] == 'DRY_RUN_READY'
      raise 'ARCHON_EXECUTOR_PLAN_TARGET_INVALID' unless plan['targetEngine'] == 'SKETCHUP'
      raise 'ARCHON_EXECUTOR_PLAN_MODE_INVALID' unless plan['executionMode'] == 'NATIVE_2D_DRY_RUN'
      raise 'ARCHON_EXECUTOR_PLAN_UNITS_INVALID' unless plan['units'] == 'mm'

      source = plan['source']
      safety = plan['safety']
      operations = plan['operations']
      raise 'ARCHON_EXECUTOR_PLAN_SOURCE_INVALID' unless source.is_a?(Hash)
      raise 'ARCHON_EXECUTOR_PLAN_SAFETY_INVALID' unless safety.is_a?(Hash)
      raise 'ARCHON_EXECUTOR_PLAN_OPERATIONS_INVALID' unless operations.is_a?(Array) && !operations.empty?
      raise 'ARCHON_EXECUTOR_PLAN_OPERATION_COUNT_MISMATCH' unless plan['operationCount'].to_i == operations.length
      raise 'ARCHON_EXECUTOR_PLAN_PACKAGE_HASH_INVALID' unless source['packageHash'].to_s.match?(/\A[a-f0-9]{64}\z/i)

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
  end
end
