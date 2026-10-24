# frozen_string_literal: true
require 'sketchup.rb'
require 'extensions.rb'

module ArchonConceptSandbox
  unless const_defined?(:EXTENSION)
    ext = SketchupExtension.new('ARCHON Concept Sandbox', 'archon_concept_sandbox/main')
    ext.description = 'Creates a 3D concept in a new blank model after explicit approval.'
    ext.version = '0.1.0'
    ext.creator = 'ARCHON'
    Sketchup.register_extension(ext, true)
    EXTENSION = ext
  end
end
