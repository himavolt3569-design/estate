-- =============================================================================
-- 0013 — Reference data seed
-- =============================================================================
-- This is authorization and taxonomy data, not sample content. It ships as a
-- migration (not seed.sql) because the permission matrix is part of the security
-- model and must exist identically in every environment.
-- =============================================================================
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('property.create',    'Create a listing'),
  ('property.edit',      'Edit a listing they are entitled to'),
  ('property.delete',    'Remove a listing they are entitled to'),
  ('property.publish',   'Approve or reject a listing for public display'),
  ('property.verify',    'Record a verification decision on a listing or user'),
  ('enquiry.view',       'Read enquiries they are a party to'),
  ('enquiry.respond',    'Reply to and progress an enquiry'),
  ('appointment.manage', 'Request, confirm, or decline a viewing'),
  ('payment.manage',     'Maintain payment instructions'),
  ('payment.verify',     'Approve or reject a proof of payment'),
  ('user.manage',        'Change a user''s role or profile'),
  ('user.suspend',       'Suspend or reinstate a user'),
  ('report.resolve',     'Work the moderation queue'),
  ('review.moderate',    'Publish or reject a review'),
  ('audit.view',         'Read the audit trail'),
  ('system.manage',      'Read system health and change platform settings')
on conflict (key) do update set description = excluded.description;

-- -----------------------------------------------------------------------------
-- Role → permission matrix (docs/03-security-model.md §3.1)
-- A permission says whether this class of user may do a thing AT ALL; the RLS
-- row predicate independently decides on WHICH ROWS. Both always apply.
-- -----------------------------------------------------------------------------
insert into public.role_permissions (role, permission_key)
-- Platform admin holds everything.
select 'platform_admin'::public.user_role, key from public.permissions
union all
select 'agency_manager'::public.user_role, key from unnest(array[
  'property.create','property.edit','property.delete',
  'enquiry.view','enquiry.respond','appointment.manage',
  'payment.manage','payment.verify'
]) as key
union all
select 'agent'::public.user_role, key from unnest(array[
  'property.create','property.edit',
  'enquiry.view','enquiry.respond','appointment.manage',
  'payment.manage'
]) as key
union all
select 'property_owner'::public.user_role, key from unnest(array[
  'property.create','property.edit','property.delete',
  'enquiry.view','enquiry.respond','appointment.manage',
  'payment.manage','payment.verify'
]) as key
union all
select 'customer'::public.user_role, key from unnest(array[
  'enquiry.view','appointment.manage'
]) as key
on conflict do nothing;

-- =============================================================================
-- Nepal administrative hierarchy
-- =============================================================================
-- Centroids are approximate district centres, good enough to fit a map view.
-- Replace with the official Survey Department boundary set before launch; the
-- `bounds` polygon column is left null until then.
-- =============================================================================

insert into public.locations (level, name_en, name_ne, slug, centroid) values
  ('country', 'Nepal', 'नेपाल', 'nepal',
   st_setsrid(st_makepoint(84.1240, 28.3949), 4326)::geography)
on conflict do nothing;

insert into public.locations (parent_id, level, name_en, name_ne, slug, centroid)
select (select id from public.locations where slug = 'nepal'),
       'province', v.en, v.ne, v.slug,
       st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography
from (values
  ('Koshi',          'कोशी प्रदेश',          'koshi',          27.00, 87.30),
  ('Madhesh',        'मधेश प्रदेश',          'madhesh',        26.85, 85.60),
  ('Bagmati',        'बागमती प्रदेश',        'bagmati',        27.75, 85.30),
  ('Gandaki',        'गण्डकी प्रदेश',        'gandaki',        28.40, 84.00),
  ('Lumbini',        'लुम्बिनी प्रदेश',       'lumbini',        27.90, 82.80),
  ('Karnali',        'कर्णाली प्रदेश',        'karnali',        29.20, 82.00),
  ('Sudurpashchim',  'सुदूरपश्चिम प्रदेश',   'sudurpashchim',  29.30, 80.80)
) as v(en, ne, slug, lat, lng)
on conflict do nothing;

insert into public.locations (parent_id, level, name_en, name_ne, slug, centroid)
select p.id, 'district', v.en, v.ne, v.slug,
       st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography
from (values
  -- Koshi (14)
  ('koshi','Bhojpur','भोजपुर','bhojpur',27.17,87.05),
  ('koshi','Dhankuta','धनकुटा','dhankuta',26.98,87.34),
  ('koshi','Ilam','इलाम','ilam',26.91,87.93),
  ('koshi','Jhapa','झापा','jhapa',26.55,87.90),
  ('koshi','Khotang','खोटाङ','khotang',27.20,86.80),
  ('koshi','Morang','मोरङ','morang',26.65,87.45),
  ('koshi','Okhaldhunga','ओखलढुङ्गा','okhaldhunga',27.32,86.50),
  ('koshi','Panchthar','पाँचथर','panchthar',27.13,87.83),
  ('koshi','Sankhuwasabha','संखुवासभा','sankhuwasabha',27.62,87.28),
  ('koshi','Solukhumbu','सोलुखुम्बु','solukhumbu',27.70,86.66),
  ('koshi','Sunsari','सुनसरी','sunsari',26.63,87.15),
  ('koshi','Taplejung','ताप्लेजुङ','taplejung',27.35,87.67),
  ('koshi','Terhathum','तेह्रथुम','terhathum',27.12,87.55),
  ('koshi','Udayapur','उदयपुर','udayapur',26.85,86.85),
  -- Madhesh (8)
  ('madhesh','Bara','बारा','bara',27.03,85.03),
  ('madhesh','Dhanusha','धनुषा','dhanusha',26.83,86.03),
  ('madhesh','Mahottari','महोत्तरी','mahottari',26.90,85.80),
  ('madhesh','Parsa','पर्सा','parsa',27.05,84.85),
  ('madhesh','Rautahat','रौतहट','rautahat',26.92,85.28),
  ('madhesh','Saptari','सप्तरी','saptari',26.60,86.75),
  ('madhesh','Sarlahi','सर्लाही','sarlahi',26.98,85.55),
  ('madhesh','Siraha','सिरहा','siraha',26.65,86.20),
  -- Bagmati (13)
  ('bagmati','Bhaktapur','भक्तपुर','bhaktapur',27.671,85.429),
  ('bagmati','Chitwan','चितवन','chitwan',27.53,84.35),
  ('bagmati','Dhading','धादिङ','dhading',27.87,84.90),
  ('bagmati','Dolakha','दोलखा','dolakha',27.67,86.17),
  ('bagmati','Kathmandu','काठमाडौं','kathmandu',27.7172,85.3240),
  ('bagmati','Kavrepalanchok','काभ्रेपलाञ्चोक','kavrepalanchok',27.62,85.55),
  ('bagmati','Lalitpur','ललितपुर','lalitpur',27.6588,85.3247),
  ('bagmati','Makwanpur','मकवानपुर','makwanpur',27.42,85.03),
  ('bagmati','Nuwakot','नुवाकोट','nuwakot',27.92,85.16),
  ('bagmati','Ramechhap','रामेछाप','ramechhap',27.33,86.08),
  ('bagmati','Rasuwa','रसुवा','rasuwa',28.12,85.32),
  ('bagmati','Sindhuli','सिन्धुली','sindhuli',27.20,85.90),
  ('bagmati','Sindhupalchok','सिन्धुपाल्चोक','sindhupalchok',27.83,85.70),
  -- Gandaki (11)
  ('gandaki','Baglung','बागलुङ','baglung',28.27,83.60),
  ('gandaki','Gorkha','गोरखा','gorkha',28.00,84.63),
  ('gandaki','Kaski','कास्की','kaski',28.2096,83.9856),
  ('gandaki','Lamjung','लमजुङ','lamjung',28.23,84.38),
  ('gandaki','Manang','मनाङ','manang',28.67,84.02),
  ('gandaki','Mustang','मुस्ताङ','mustang',28.85,83.75),
  ('gandaki','Myagdi','म्याग्दी','myagdi',28.60,83.48),
  ('gandaki','Nawalpur','नवलपुर','nawalpur',27.70,84.13),
  ('gandaki','Parbat','पर्वत','parbat',28.23,83.68),
  ('gandaki','Syangja','स्याङ्जा','syangja',28.10,83.87),
  ('gandaki','Tanahun','तनहुँ','tanahun',27.93,84.25),
  -- Lumbini (12)
  ('lumbini','Arghakhanchi','अर्घाखाँची','arghakhanchi',27.95,83.20),
  ('lumbini','Banke','बाँके','banke',28.05,81.62),
  ('lumbini','Bardiya','बर्दिया','bardiya',28.30,81.43),
  ('lumbini','Dang','दाङ','dang',28.03,82.30),
  ('lumbini','Rukum East','पूर्वी रुकुम','rukum-east',28.63,82.68),
  ('lumbini','Gulmi','गुल्मी','gulmi',28.07,83.25),
  ('lumbini','Kapilvastu','कपिलवस्तु','kapilvastu',27.55,83.05),
  ('lumbini','Palpa','पाल्पा','palpa',27.87,83.55),
  ('lumbini','Parasi','परासी','parasi',27.53,83.67),
  ('lumbini','Pyuthan','प्युठान','pyuthan',28.10,82.87),
  ('lumbini','Rolpa','रोल्पा','rolpa',28.28,82.65),
  ('lumbini','Rupandehi','रूपन्देही','rupandehi',27.63,83.45),
  -- Karnali (10)
  ('karnali','Dailekh','दैलेख','dailekh',28.85,81.72),
  ('karnali','Dolpa','डोल्पा','dolpa',29.10,83.00),
  ('karnali','Humla','हुम्ला','humla',30.00,81.83),
  ('karnali','Jajarkot','जाजरकोट','jajarkot',28.70,82.20),
  ('karnali','Jumla','जुम्ला','jumla',29.28,82.18),
  ('karnali','Kalikot','कालीकोट','kalikot',29.13,81.62),
  ('karnali','Mugu','मुगु','mugu',29.55,82.20),
  ('karnali','Rukum West','पश्चिम रुकुम','rukum-west',28.63,82.30),
  ('karnali','Salyan','सल्यान','salyan',28.38,82.17),
  ('karnali','Surkhet','सुर्खेत','surkhet',28.60,81.63),
  -- Sudurpashchim (9)
  ('sudurpashchim','Achham','अछाम','achham',29.13,81.30),
  ('sudurpashchim','Baitadi','बैतडी','baitadi',29.53,80.48),
  ('sudurpashchim','Bajhang','बझाङ','bajhang',29.55,81.20),
  ('sudurpashchim','Bajura','बाजुरा','bajura',29.42,81.52),
  ('sudurpashchim','Dadeldhura','डडेलधुरा','dadeldhura',29.30,80.58),
  ('sudurpashchim','Darchula','दार्चुला','darchula',29.85,80.55),
  ('sudurpashchim','Doti','डोटी','doti',29.27,80.93),
  ('sudurpashchim','Kailali','कैलाली','kailali',28.68,80.92),
  ('sudurpashchim','Kanchanpur','कञ्चनपुर','kanchanpur',28.83,80.33)
) as v(province, en, ne, slug, lat, lng)
join public.locations p on p.slug = v.province and p.level = 'province'
on conflict do nothing;

-- A starter set of municipalities for the Kathmandu valley, where most early
-- listing volume will be. The full national municipality list should be imported
-- from the official dataset before launch.
insert into public.locations (parent_id, level, name_en, name_ne, slug, centroid)
select d.id, 'municipality', v.en, v.ne, v.slug,
       st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography
from (values
  ('kathmandu','Kathmandu Metropolitan City','काठमाडौं महानगरपालिका','kathmandu-metro',27.7172,85.3240),
  ('kathmandu','Budhanilkantha','बूढानीलकण्ठ','budhanilkantha',27.7783,85.3620),
  ('kathmandu','Tokha','टोखा','tokha',27.7580,85.3290),
  ('kathmandu','Kirtipur','कीर्तिपुर','kirtipur',27.6786,85.2775),
  ('kathmandu','Chandragiri','चन्द्रागिरि','chandragiri',27.6800,85.2400),
  ('kathmandu','Gokarneshwar','गोकर्णेश्वर','gokarneshwar',27.7500,85.4000),
  ('lalitpur','Lalitpur Metropolitan City','ललितपुर महानगरपालिका','lalitpur-metro',27.6588,85.3247),
  ('lalitpur','Godawari','गोदावरी','godawari',27.5970,85.3800),
  ('lalitpur','Mahalaxmi','महालक्ष्मी','mahalaxmi',27.6400,85.3600),
  ('bhaktapur','Bhaktapur Municipality','भक्तपुर नगरपालिका','bhaktapur-municipality',27.6710,85.4298),
  ('bhaktapur','Madhyapur Thimi','मध्यपुर थिमी','madhyapur-thimi',27.6800,85.3850),
  ('bhaktapur','Suryabinayak','सूर्यविनायक','suryabinayak',27.6600,85.4300),
  ('kaski','Pokhara Metropolitan City','पोखरा महानगरपालिका','pokhara-metro',28.2096,83.9856),
  ('chitwan','Bharatpur Metropolitan City','भरतपुर महानगरपालिका','bharatpur-metro',27.6833,84.4333)
) as v(district, en, ne, slug, lat, lng)
join public.locations d on d.slug = v.district and d.level = 'district'
on conflict do nothing;

-- =============================================================================
-- Features (amenities)
-- =============================================================================
insert into public.features (key, label_en, label_ne, icon, category, position) values
  ('furnished',            'Furnished',              'फर्निच्ड',            'sofa',          'interior', 10),
  ('semi_furnished',       'Semi-furnished',         'अर्ध फर्निच्ड',       'armchair',      'interior', 20),
  ('modular_kitchen',      'Modular kitchen',        'मोड्युलर भान्सा',      'chef-hat',      'interior', 30),
  ('air_conditioning',     'Air conditioning',       'एयर कन्डिसन',         'wind',          'interior', 40),
  ('balcony',              'Balcony',                'बाल्कनी',             'building',      'interior', 50),
  ('garden',               'Garden',                 'बगैंचा',              'trees',         'exterior', 60),
  ('swimming_pool',        'Swimming pool',          'स्विमिङ पुल',         'waves',         'exterior', 70),
  ('parking_covered',      'Covered parking',        'ढाकिएको पार्किङ',      'car-front',     'exterior', 80),
  ('terrace',              'Terrace',                'कौसी',                'layout-grid',   'exterior', 90),
  ('boundary_wall',        'Boundary wall',          'कम्पाउन्ड पर्खाल',     'brick-wall',    'exterior', 100),
  ('lift',                 'Lift',                   'लिफ्ट',               'arrow-up-down', 'building', 110),
  ('security_guard',       'Security guard',         'सुरक्षा गार्ड',        'shield',        'building', 120),
  ('cctv',                 'CCTV',                   'सीसीटीभी',            'cctv',          'building', 130),
  ('backup_power',         'Backup power',           'ब्याकअप बिजुली',       'zap',           'utility',  140),
  ('solar_water',          'Solar water heating',    'सोलार वाटर हिटर',     'sun',           'utility',  150),
  ('borewell',             'Borewell',               'बोरिङ',               'droplet',       'utility',  160),
  ('municipal_water',      'Municipal water',        'खानेपानी',            'droplets',      'utility',  170),
  ('internet_ready',       'Internet ready',         'इन्टरनेट',            'wifi',          'utility',  180),
  ('earthquake_resistant', 'Earthquake resistant',   'भूकम्प प्रतिरोधी',     'shield-check',  'structure',190),
  ('pillar_system',        'Pillar system',          'पिलर सिस्टम',         'columns-3',     'structure',200),
  ('corner_plot',          'Corner plot',            'कर्नर जग्गा',          'square',        'land',     210),
  ('road_touched',         'Road touched',           'सडक छोएको',           'route',         'land',     220),
  ('river_view',           'River view',             'नदी दृश्य',           'waves',         'outlook',  230),
  ('mountain_view',        'Mountain view',          'हिमाल दृश्य',         'mountain',      'outlook',  240),
  ('pet_friendly',         'Pet friendly',           'पाल्तु जनावर',        'paw-print',     'policy',   250)
on conflict (key) do update
  set label_en = excluded.label_en, label_ne = excluded.label_ne, icon = excluded.icon;

-- =============================================================================
-- Attribute definitions
-- =============================================================================
-- Which fields appear on which subtype's form, with their validation. Adding
-- "has solar water heater" later is a row here, not a schema migration.
-- =============================================================================
insert into public.attribute_definitions
  (key, label_en, label_ne, value_type, unit, options, applies_to, is_required, min_value, max_value, display_group, position)
values
  -- Residential -------------------------------------------------------------
  ('bedrooms','Bedrooms','कोठा','number',null,null,
   array['house','apartment','villa','condo','townhouse','studio']::public.property_subtype[],
   true, 0, 100, 'layout', 10),
  ('bathrooms','Bathrooms','बाथरुम','number',null,null,
   array['house','apartment','villa','condo','townhouse','studio']::public.property_subtype[],
   true, 0, 100, 'layout', 20),
  ('floors','Floors','तल्ला','number',null,null,
   array['house','villa','townhouse','office','shop','warehouse','factory']::public.property_subtype[],
   true, 0, 200, 'layout', 30),
  ('parking','Parking spaces','पार्किङ','number',null,null,
   array['house','apartment','villa','condo','townhouse','office','shop','warehouse','factory']::public.property_subtype[],
   false, 0, 100, 'layout', 40),
  ('year_built','Year built','निर्माण वर्ष','number',null,null,
   array['house','apartment','villa','condo','townhouse','studio','office','shop','warehouse','factory']::public.property_subtype[],
   false, 1950, 2100, 'construction', 50),
  ('facing','Facing','मोहडा','enum',null,
   array['East','West','North','South','North-East','North-West','South-East','South-West'],
   array['house','villa','townhouse','residential_land','agricultural_land','commercial_land']::public.property_subtype[],
   false, null, null, 'construction', 60),

  -- Apartment specific ------------------------------------------------------
  ('floor_number','Floor number','तल्ला नम्बर','number',null,null,
   array['apartment','condo','studio','office','shop']::public.property_subtype[],
   true, 0, 200, 'building', 70),
  ('building_name','Building name','भवनको नाम','text',null,null,
   array['apartment','condo','studio','office','shop']::public.property_subtype[],
   false, null, null, 'building', 80),
  ('total_floors','Floors in building','भवनको कुल तल्ला','number',null,null,
   array['apartment','condo','studio','office','shop']::public.property_subtype[],
   false, 1, 200, 'building', 90),
  ('has_lift','Lift','लिफ्ट','boolean',null,null,
   array['apartment','condo','studio','office']::public.property_subtype[],
   false, null, null, 'building', 100),
  ('has_security','24/7 security','२४ घण्टा सुरक्षा','boolean',null,null,
   array['apartment','condo','studio','office','shop']::public.property_subtype[],
   false, null, null, 'building', 110),
  ('service_charge_monthly','Monthly service charge','मासिक सेवा शुल्क','number','NPR',null,
   array['apartment','condo','studio','office','shop']::public.property_subtype[],
   false, 0, null, 'building', 120),

  -- Land specific -----------------------------------------------------------
  ('land_type','Land type','जग्गाको किसिम','enum',null,
   array['Residential','Agricultural','Commercial','Industrial','Mixed'],
   array['residential_land','agricultural_land','commercial_land']::public.property_subtype[],
   true, null, null, 'land', 130),
  ('road_access_ft','Road access width','बाटोको चौडाइ','number','ft',null,
   array['residential_land','agricultural_land','commercial_land','house','villa','warehouse','factory']::public.property_subtype[],
   true, 0, 500, 'land', 140),
  ('road_type','Road type','बाटोको किसिम','enum',null,
   array['Blacktopped','Gravelled','Soil','Concrete'],
   array['residential_land','agricultural_land','commercial_land','house','villa']::public.property_subtype[],
   false, null, null, 'land', 150),
  ('zoning','Zoning','क्षेत्र वर्गीकरण','text',null,null,
   array['residential_land','agricultural_land','commercial_land']::public.property_subtype[],
   false, null, null, 'land', 160),
  ('plotted','Plotted','प्लटिङ','boolean',null,null,
   array['residential_land','commercial_land']::public.property_subtype[],
   false, null, null, 'land', 170),

  -- Commercial specific -----------------------------------------------------
  ('ceiling_height_ft','Ceiling height','उचाइ','number','ft',null,
   array['warehouse','factory','office','shop']::public.property_subtype[],
   false, 0, 200, 'commercial', 180),
  ('loading_dock','Loading dock','लोडिङ डक','boolean',null,null,
   array['warehouse','factory']::public.property_subtype[],
   false, null, null, 'commercial', 190),
  ('power_phase','Power supply','बिजुली','enum',null, array['Single phase','Three phase'],
   array['warehouse','factory','office','shop']::public.property_subtype[],
   false, null, null, 'commercial', 200),
  ('frontage_ft','Frontage','अगाडिको चौडाइ','number','ft',null,
   array['shop','office','commercial_land']::public.property_subtype[],
   false, 0, 500, 'commercial', 210)
on conflict (key) do update
  set label_en = excluded.label_en, applies_to = excluded.applies_to,
      is_required = excluded.is_required, options = excluded.options;
