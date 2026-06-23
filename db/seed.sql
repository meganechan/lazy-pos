-- lazy-pos seed — only runs when store table is empty (see server bootstrap)

INSERT INTO store (name) VALUES ('Lazy Nails — Bangkok');

INSERT INTO service (store_id, name, category, base_price, duration_min) VALUES
  (1, 'Classic Manicure',       'Manicure', 350, 40),
  (1, 'Gel Manicure',           'Manicure', 650, 60),
  (1, 'Classic Pedicure',       'Pedicure', 450, 50),
  (1, 'Gel Pedicure',           'Pedicure', 750, 70),
  (1, 'Nail Art (per nail)',    'Art',      80, 15),
  (1, 'Gel Removal',            'Care',     150, 20),
  (1, 'Hand Spa & Paraffin',    'Spa',      500, 45),
  (1, 'Acrylic Extension',      'Extension',1200,120);

INSERT INTO member (store_id, name, phone, line_user_id, notes) VALUES
  (1, 'Ploy Srisuk',   '081-234-5678', 'U_ploy_demo',  'Prefers nude tones'),
  (1, 'Mint Boonmee',  '089-555-1212', 'U_mint_demo',  'Allergic to cheap acrylic'),
  (1, 'Fah Wong',      '092-777-0099', NULL,            'Walk-in, new');
