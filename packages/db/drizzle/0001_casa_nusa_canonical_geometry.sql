INSERT INTO canonical_objects (archon_id, project_id, object_type, parameters, relationships, revision, provenance)
SELECT v.archon_id, p.id, v.object_type, v.parameters::jsonb, v.relationships::jsonb, 1,
       jsonb_build_object('source','ARCHON_CHECKPOINT_E','authority','BUILDING','unit','mm','version','2')
FROM projects p
CROSS JOIN (VALUES
 ('archon_slab_ground','SLAB','{"label":"Ground slab","positionMm":[0,-100,0],"sizeMm":[24800,200,15000],"material":"Concrete"}','{"level":"Ground Floor","contains":["archon_room_kitchen","archon_room_dining"]}'),
 ('archon_wall_north','WALL','{"label":"North wall","positionMm":[0,1600,-7400],"sizeMm":[24800,3200,200],"material":"AAC + Plaster"}','{"level":"Ground Floor","bounds":["archon_room_kitchen","archon_room_dining"]}'),
 ('archon_wall_south','WALL','{"label":"South wall","positionMm":[0,1600,7400],"sizeMm":[24800,3200,200],"material":"AAC + Plaster"}','{"level":"Ground Floor","bounds":["archon_room_dining"]}'),
 ('archon_wall_west','WALL','{"label":"West wall","positionMm":[-12300,1600,0],"sizeMm":[200,3200,14800],"material":"AAC + Plaster"}','{"level":"Ground Floor","bounds":["archon_room_kitchen"]}'),
 ('archon_wall_east','WALL','{"label":"East wall","positionMm":[12300,1600,0],"sizeMm":[200,3200,14800],"material":"AAC + Plaster"}','{"level":"Ground Floor","bounds":["archon_room_dining"]}'),
 ('archon_room_kitchen','ROOM','{"label":"Kitchen","positionMm":[-8500,150,-3800],"sizeMm":[6400,300,5200],"widthMm":6400,"material":"Program Volume"}','{"level":"Ground Floor","boundedBy":["archon_wall_north","archon_wall_west"],"adjacentTo":["archon_room_dining"]}'),
 ('archon_room_dining','ROOM','{"label":"Indoor Dining","positionMm":[1800,150,0],"sizeMm":[11200,300,8200],"material":"Program Volume"}','{"level":"Ground Floor","boundedBy":["archon_wall_north","archon_wall_south","archon_wall_east"],"adjacentTo":["archon_room_kitchen"]}')
) AS v(archon_id,object_type,parameters,relationships)
WHERE p.name='Casa Nusa Restaurant'
ON CONFLICT (archon_id) DO NOTHING;
