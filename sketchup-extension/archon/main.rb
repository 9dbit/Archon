# frozen_string_literal: true

require 'sketchup.rb'
require 'json'
require 'time'
require_relative 'config'
require_relative 'manifest'
require_relative 'client'
require_relative 'executor'
require_relative 'dialog'

module Archon
  module Main
    module_function

    def show_panel
      Archon::Dialog.show
    end

    def prompt_package_hash(title)
      values = UI.inputbox(
        ['Approved execution package SHA-256'],
        [''],
        title
      )
      return nil unless values

      package_hash = values.first.to_s.strip.downcase
      unless package_hash.match?(/\A[a-f0-9]{64}\z/)
        UI.messagebox('ARCHON requires a 64-character approved package SHA-256.')
        return nil
      end

      package_hash
    end

    def run_executor_dry_run
      package_hash = prompt_package_hash('ARCHON SketchUp Executor Dry-Run')
      return unless package_hash

      Archon::Client.dry_run_execution_package(package_hash) do |status, response|
        unless status >= 200 && status < 300
          error = response.is_a?(Hash) ? response['error'].to_s : 'UNKNOWN_ERROR'
          UI.messagebox("ARCHON executor dry-run rejected (HTTP #{status}): #{error}")
          next
        end

        begin
          plan = response.fetch('plan')
          report = Archon::Executor.dry_run(plan)
          summary = report.fetch('summary')
          UI.messagebox(
            "ARCHON dry-run verified.\n\n" \
            "Plan: #{report['planFingerprint']}\n" \
            "Operations: #{report['operationCount']}\n" \
            "Rooms: #{summary['createRoom']}\n" \
            "Walls: #{summary['createWall']}\n" \
            "Doors: #{summary['createDoor']}\n" \
            "Labels: #{summary['createLabel']}\n\n" \
            "No SketchUp transaction was opened. Geometry mutation remains locked.\n" \
            "Next gate: #{report.dig('safety', 'requiredNextGate')}"
          )
          puts JSON.pretty_generate(report)
        rescue StandardError => error
          UI.messagebox("ARCHON local dry-run failed: #{error.message}")
        end
      end
    rescue StandardError => error
      UI.messagebox("ARCHON executor dry-run failed: #{error.message}")
    end

    def run_executor_rollback_rehearsal
      package_hash = prompt_package_hash('ARCHON SketchUp Rollback Rehearsal')
      return unless package_hash

      Archon::Client.rehearse_execution_package(package_hash) do |status, response|
        unless status >= 200 && status < 300
          error = response.is_a?(Hash) ? response['error'].to_s : 'UNKNOWN_ERROR'
          UI.messagebox("ARCHON rollback rehearsal rejected (HTTP #{status}): #{error}")
          next
        end

        begin
          plan = response.fetch('plan')
          report = Archon::Executor.rollback_rehearsal(plan)
          materialized = report.fetch('materialized')
          UI.messagebox(
            "ARCHON rollback rehearsal verified.\n\n" \
            "Plan: #{report['planFingerprint']}\n" \
            "Temporary operation groups: #{materialized['operationGroups']}\n" \
            "Rooms: #{materialized['rooms']}\n" \
            "Walls: #{materialized['walls']}\n" \
            "Doors: #{materialized['doors']}\n" \
            "Labels: #{materialized['labels']}\n\n" \
            "Transaction was aborted and root entity count returned to its original value.\n" \
            "No geometry was persisted. Persistent execution remains locked.\n" \
            "Next gate: #{report.dig('safety', 'requiredNextGate')}"
          )
          puts JSON.pretty_generate(report)
        rescue StandardError => error
          UI.messagebox("ARCHON rollback rehearsal failed: #{error.message}")
        end
      end
    rescue StandardError => error
      UI.messagebox("ARCHON rollback rehearsal failed: #{error.message}")
    end

    unless file_loaded?(__FILE__)
      command = UI::Command.new('ARCHON') { show_panel }
      command.tooltip = 'Open ARCHON'
      command.status_bar_text = 'Open ARCHON SketchUp + LayOut production bridge.'

      dry_run_command = UI::Command.new('ARCHON Executor Dry-Run') { run_executor_dry_run }
      dry_run_command.tooltip = 'Verify an approved ARCHON execution package without changing SketchUp geometry.'
      dry_run_command.status_bar_text = 'Dry-run an immutable approved package. SketchUp mutation remains locked.'

      rehearsal_command = UI::Command.new('ARCHON Rollback Rehearsal') { run_executor_rollback_rehearsal }
      rehearsal_command.tooltip = 'Create temporary native 2D geometry inside a transaction that is always aborted.'
      rehearsal_command.status_bar_text = 'Rehearse approved ARCHON geometry with mandatory rollback. Persistent mutation remains locked.'

      extensions_menu = UI.menu('Extensions')
      extensions_menu.add_item(command)
      extensions_menu.add_item(dry_run_command)
      extensions_menu.add_item(rehearsal_command)

      toolbar = UI::Toolbar.new('ARCHON')
      toolbar.add_item(command)
      toolbar.add_separator
      toolbar.add_item(dry_run_command)
      toolbar.add_item(rehearsal_command)
      toolbar.restore

      file_loaded(__FILE__)
    end
  end
end
