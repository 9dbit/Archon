# frozen_string_literal: true

require 'sketchup.rb'
require 'extensions.rb'

module Archon
  EXTENSION_ID = 'com.archon.sketchup'
  EXTENSION_NAME = 'ARCHON'
  EXTENSION_VERSION = '0.3.3'

  unless const_defined?(:EXTENSION)
    extension = SketchupExtension.new(EXTENSION_NAME, 'archon/main')
    extension.description = 'ARCHON AI production bridge for SketchUp + LayOut.'
    extension.version = EXTENSION_VERSION
    extension.creator = 'ARCHON'
    Sketchup.register_extension(extension, true)
    EXTENSION = extension
  end
end
