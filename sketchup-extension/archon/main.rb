# frozen_string_literal: true

require 'sketchup.rb'
require 'json'
require 'time'
require_relative 'config'
require_relative 'manifest'
require_relative 'client'
require_relative 'dialog'

module Archon
  module Main
    module_function

    def show_panel
      Archon::Dialog.show
    end

    unless file_loaded?(__FILE__)
      command = UI::Command.new('ARCHON') { show_panel }
      command.tooltip = 'Open ARCHON'
      command.status_bar_text = 'Open ARCHON SketchUp + LayOut production bridge.'

      UI.menu('Extensions').add_item(command)

      toolbar = UI::Toolbar.new('ARCHON')
      toolbar.add_item(command)
      toolbar.restore

      file_loaded(__FILE__)
    end
  end
end
