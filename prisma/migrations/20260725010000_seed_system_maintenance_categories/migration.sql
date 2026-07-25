-- System maintenance categories are required reference data, not demo data.
-- Insert only missing names so deployments previously initialized by seed remain unchanged.
INSERT INTO "MaintenanceCategory" (
  "id",
  "name",
  "iconKey",
  "sortOrder",
  "isSystem"
)
SELECT
  defaults."id",
  defaults."name",
  defaults."iconKey",
  defaults."sortOrder",
  true
FROM (
  VALUES
    ('10000000-0000-4000-8000-000000000001', 'Двигатель и масла', 'oil', 1),
    ('10000000-0000-4000-8000-000000000002', 'Трансмиссия', 'gears', 2),
    ('10000000-0000-4000-8000-000000000003', 'Тормозная система', 'brakes', 3),
    ('10000000-0000-4000-8000-000000000004', 'Ходовая часть', 'suspension', 4),
    ('10000000-0000-4000-8000-000000000005', 'Электрика', 'battery', 5),
    ('10000000-0000-4000-8000-000000000006', 'Шины и колёса', 'tire', 6),
    ('10000000-0000-4000-8000-000000000007', 'Кузов и салон', 'car', 7),
    ('10000000-0000-4000-8000-000000000008', 'Прочее', 'wrench', 99)
) AS defaults("id", "name", "iconKey", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1
  FROM "MaintenanceCategory" existing
  WHERE existing."isSystem" = true
    AND existing."name" = defaults."name"
);
