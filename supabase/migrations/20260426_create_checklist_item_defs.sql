CREATE TABLE checklist_item_defs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_definition_id uuid REFERENCES visit_definitions(id) ON DELETE CASCADE,
  name text NOT NULL,
  plazo_horas integer NOT NULL DEFAULT 0,
  sort_order integer DEFAULT 0
);

ALTER TABLE checklist_item_defs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_checklist_item_defs"
  ON checklist_item_defs FOR ALL USING (true);
