-- 1. Tabla de plantillas de checklist
CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  visit_type text NOT NULL CHECK (visit_type IN ('presencial','telefonica')),
  is_global boolean DEFAULT false,
  protocol_id text REFERENCES protocols(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. Tabla de ítems de plantilla
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES checklist_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  plazo_horas integer NOT NULL DEFAULT 0,
  obligatorio boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0
);

-- 3. Agregar campo obligatorio a checklist_items existente
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS obligatorio boolean NOT NULL DEFAULT true;

-- 4. Habilitar RLS
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items ENABLE ROW LEVEL SECURITY;

-- 5. Políticas permisivas
CREATE POLICY "allow_all_templates"
  ON checklist_templates FOR ALL USING (true);
CREATE POLICY "allow_all_template_items"
  ON checklist_template_items FOR ALL USING (true);

-- 6. Insertar plantillas madre globales
INSERT INTO checklist_templates (name, visit_type, is_global)
VALUES
  ('Plantilla presencial', 'presencial', true),
  ('Plantilla telefónica', 'telefonica', true);

-- 7. Insertar ítems plantilla madre presencial
WITH template AS (
  SELECT id FROM checklist_templates
  WHERE is_global = true AND visit_type = 'presencial'
  LIMIT 1
)
INSERT INTO checklist_template_items
  (template_id, name, plazo_horas, obligatorio, sort_order)
SELECT
  template.id, items.name, items.plazo_horas,
  items.obligatorio, items.sort_order
FROM template, (VALUES
  ('Toma de signos vitales', 0, true, 1),
  ('Orina', 0, true, 2),
  ('Sangre', 0, true, 3),
  ('Compliance', 0, true, 4),
  ('ECG', 0, true, 5),
  ('Espirometría', 0, true, 6),
  ('Oscilometría', 0, true, 7),
  ('FeNO', 0, true, 8),
  ('Reporte de laboratorio', 168, true, 9),
  ('Reporte de orina', 168, true, 10)
) AS items(name, plazo_horas, obligatorio, sort_order);

-- 8. Insertar ítems plantilla madre telefónica
WITH template AS (
  SELECT id FROM checklist_templates
  WHERE is_global = true AND visit_type = 'telefonica'
  LIMIT 1
)
INSERT INTO checklist_template_items
  (template_id, name, plazo_horas, obligatorio, sort_order)
SELECT
  template.id, items.name, items.plazo_horas,
  items.obligatorio, items.sort_order
FROM template, (VALUES
  ('Visita evolucionada', 0, false, 1)
) AS items(name, plazo_horas, obligatorio, sort_order);

-- 9. Verificar que todo quedó bien
SELECT
  ct.name, ct.visit_type, ct.is_global,
  COUNT(cti.id) as total_items
FROM checklist_templates ct
LEFT JOIN checklist_template_items cti ON cti.template_id = ct.id
GROUP BY ct.id, ct.name, ct.visit_type, ct.is_global;
