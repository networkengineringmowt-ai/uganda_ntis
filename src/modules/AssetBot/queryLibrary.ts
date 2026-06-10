export const QUERY_LIBRARY: Record<string, string> = {
  Q01: `SELECT rl.link_id, rl.link_name, rl.road, rl.road_class, rl.surface, rl.region,
    ROUND(rl.length_km,1) AS length_km,
    COALESCE(cs.iri_measured, mp.iri_predicted, 0) AS iri,
    COALESCE(cs.overall_condition,'Unknown') AS condition
  FROM road_links rl
  LEFT JOIN condition_surveys cs ON rl.link_id=cs.link_id
  LEFT JOIN ml_predictions mp ON rl.link_id=mp.link_id
  WHERE COALESCE(cs.iri_measured,mp.iri_predicted,0)>8
     OR cs.overall_condition IN ('Bad','Very Bad')
  ORDER BY iri DESC LIMIT 50`,

  Q02: `SELECT rl.region,
    COUNT(DISTINCT rl.link_id) AS links,
    ROUND(SUM(rl.length_km),0) AS total_km,
    ROUND(SUM(rl.length_km*10),0) AS routine_ugx_m,
    ROUND(SUM(rl.length_km*CASE COALESCE(cs.overall_condition,'Fair')
      WHEN 'Very Bad' THEN 900 WHEN 'Bad' THEN 400 WHEN 'Poor' THEN 160 ELSE 10 END),0) AS total_ugx_m
  FROM road_links rl
  LEFT JOIN condition_surveys cs ON rl.link_id=cs.link_id
  GROUP BY rl.region ORDER BY total_ugx_m DESC`,

  Q03: `SELECT rl.link_id, rl.link_name, rl.road, rl.region,
    ROUND(rl.length_km,1) AS length_km,
    ROUND(COALESCE(mp.urgency_score,0),3) AS urgency,
    ROUND(COALESCE(mp.iri_predicted,0),1) AS iri_pred,
    COALESCE(mp.condition_class,0) AS cond_class
  FROM road_links rl
  LEFT JOIN ml_predictions mp ON rl.link_id=mp.link_id
  ORDER BY urgency DESC LIMIT 20`,

  Q04: `SELECT rl.link_id, rl.link_name, rl.road, rl.region, rl.road_class,
    ROUND(rl.length_km,1) AS length_km,
    ROUND(COALESCE(tc.aadt,0),0) AS aadt,
    ROUND(COALESCE(tc.heavy_veh_pct,0),1) AS heavy_pct,
    ROUND(COALESCE(tc.aadt,0)*COALESCE(tc.heavy_veh_pct,0)/100*2.4*365,0) AS esal_per_yr
  FROM road_links rl
  LEFT JOIN traffic_counts tc ON rl.link_id=tc.link_id
  ORDER BY esal_per_yr DESC LIMIT 30`,

  Q05: `SELECT COALESCE(rl.region,'Unknown') AS region,
    COUNT(b.bridge_id) AS bridges,
    SUM(CASE WHEN COALESCE(b.condition_rating,3)>=4 THEN 1 ELSE 0 END) AS good,
    SUM(CASE WHEN COALESCE(b.condition_rating,3)=3  THEN 1 ELSE 0 END) AS fair,
    SUM(CASE WHEN COALESCE(b.condition_rating,3)<=2 THEN 1 ELSE 0 END) AS poor_critical
  FROM bridges b
  LEFT JOIN road_links rl ON b.link_id=rl.link_id
  GROUP BY rl.region ORDER BY poor_critical DESC`,

  Q06: `SELECT rl.link_id, rl.link_name, rl.road, rl.region,
    ROUND(rl.length_km,1) AS length_km,
    ROUND(COALESCE(tc.aadt,0),0) AS aadt,
    ROUND(COALESCE(tc.heavy_veh_pct,0),1) AS heavy_pct,
    tc.count_year
  FROM road_links rl
  LEFT JOIN traffic_counts tc ON rl.link_id=tc.link_id
  WHERE tc.aadt IS NOT NULL
  ORDER BY aadt DESC LIMIT 30`,

  Q08: `SELECT rl.region,
    COALESCE(rl.road_class,'Unknown') AS road_class,
    COUNT(*) AS links,
    ROUND(SUM(rl.length_km),0) AS backlog_km,
    ROUND(SUM(rl.length_km*CASE cs.overall_condition
      WHEN 'Poor'     THEN 160
      WHEN 'Bad'      THEN 400
      WHEN 'Very Bad' THEN 900
      ELSE 0 END),0) AS cost_ugx_m
  FROM road_links rl
  JOIN condition_surveys cs ON rl.link_id=cs.link_id
  WHERE cs.overall_condition IN ('Poor','Bad','Very Bad')
  GROUP BY rl.region, rl.road_class ORDER BY cost_ugx_m DESC`,

  Q09: `SELECT p.project_name, p.road, p.region, p.contractor,
    p.contract_value_ugx_m, p.start_date, p.completion_date,
    COALESCE(p.status,'Unknown') AS status
  FROM projects p
  ORDER BY p.contract_value_ugx_m DESC LIMIT 30`,

  Q10: `SELECT rl.link_id, rl.link_name, rl.road, rl.region,
    ROUND(rl.length_km,1) AS length_km,
    ROUND(COALESCE(mp.iri_predicted,0),1) AS current_iri,
    ROUND(COALESCE(mp.iri_predicted,0)+2.5,1) AS projected_iri_2yr,
    ROUND(COALESCE(mp.urgency_score,0),3) AS urgency
  FROM road_links rl
  LEFT JOIN ml_predictions mp ON rl.link_id=mp.link_id
  WHERE COALESCE(mp.iri_predicted,0)+2.5>8
     OR COALESCE(mp.urgency_score,0)>0.7
  ORDER BY urgency DESC LIMIT 30`,

  Q11: `SELECT rl.link_id, rl.link_name, rl.road, rl.region,
    ROUND(rl.length_km,1) AS length_km,
    COALESCE(cs.overall_condition,'Unknown') AS condition,
    ROUND(COALESCE(mp.urgency_score,0),3) AS urgency,
    ROUND(rl.length_km*CASE COALESCE(cs.overall_condition,'Fair')
      WHEN 'Very Bad' THEN 900 WHEN 'Bad' THEN 400 WHEN 'Poor' THEN 160 ELSE 10 END,0) AS est_cost_ugx_m,
    CASE
      WHEN COALESCE(mp.urgency_score,0)>0.8 OR cs.overall_condition IN ('Bad','Very Bad') THEN 'Year 1-2'
      WHEN COALESCE(mp.urgency_score,0)>0.5 OR cs.overall_condition='Poor' THEN 'Year 3-4'
      ELSE 'Year 5' END AS programme_year
  FROM road_links rl
  LEFT JOIN condition_surveys cs ON rl.link_id=cs.link_id
  LEFT JOIN ml_predictions mp ON rl.link_id=mp.link_id
  ORDER BY urgency DESC LIMIT 50`,

  Q12: `SELECT
    COUNT(*) AS total_links,
    ROUND(SUM(rl.length_km),0) AS total_km,
    SUM(CASE WHEN cs.overall_condition='Good'              THEN 1 ELSE 0 END) AS good_links,
    SUM(CASE WHEN cs.overall_condition='Fair'              THEN 1 ELSE 0 END) AS fair_links,
    SUM(CASE WHEN cs.overall_condition='Poor'              THEN 1 ELSE 0 END) AS poor_links,
    SUM(CASE WHEN cs.overall_condition IN ('Bad','Very Bad') THEN 1 ELSE 0 END) AS critical_links
  FROM road_links rl
  LEFT JOIN condition_surveys cs ON rl.link_id=cs.link_id`,

  Q13: `SELECT wb.station_name, wb.road, wb.region,
    COUNT(*) AS weighed,
    SUM(CASE WHEN wb.gross_weight_t>wb.legal_limit_t THEN 1 ELSE 0 END) AS overloaded
  FROM weighbridge_records wb
  GROUP BY wb.station_name, wb.road, wb.region
  ORDER BY overloaded DESC LIMIT 20`,

  Q15: `SELECT rl.surface,
    COUNT(*) AS links,
    ROUND(SUM(rl.length_km),0) AS total_km,
    ROUND(AVG(COALESCE(cs.iri_measured,mp.iri_predicted,0)),2) AS avg_iri
  FROM road_links rl
  LEFT JOIN condition_surveys cs ON rl.link_id=cs.link_id
  LEFT JOIN ml_predictions mp ON rl.link_id=mp.link_id
  GROUP BY rl.surface ORDER BY avg_iri DESC`,

  Q16: `SELECT rl.link_id, rl.road, rl.link_name, rl.region,
    ROUND(rl.length_km,1) AS length_km,
    ROUND(COALESCE(mp.iri_predicted,0),1) AS iri,
    ROUND(rl.length_km*10,0) AS agency_cost_ugx_m,
    ROUND(COALESCE(mp.urgency_score,0)*500*rl.length_km,0) AS user_cost_ugx_m
  FROM road_links rl
  LEFT JOIN ml_predictions mp ON rl.link_id=mp.link_id
  ORDER BY user_cost_ugx_m DESC LIMIT 30`,

  Q20: `SELECT rl.link_id, rl.link_name, rl.road, rl.region,
    MAX(cs.survey_date) AS last_survey,
    COALESCE(cs.overall_condition,'Never surveyed') AS last_condition
  FROM road_links rl
  LEFT JOIN condition_surveys cs ON rl.link_id=cs.link_id
  GROUP BY rl.link_id
  ORDER BY last_survey ASC NULLS FIRST LIMIT 50`,

  Q21: `-- RMS system overview (non-DB query — platform summary, NDPIV FY25/26 official figures)
  SELECT 'Road Management System' AS module,
    21302 AS total_network_km, 6405 AS paved_km, 14897 AS unpaved_km,
    30.1 AS paved_pct, 1013 AS mapped_links, 1019 AS total_structures,
    9 AS oprc_lots, 25 AS atc_stations, 6 AS maintenance_regions, 23 AS maintenance_stations`,

  Q22: `-- Global case studies reference (non-DB query — platform knowledge)
  SELECT 'Global RMS Case Studies' AS source,
    'TANROADS,KeNHA,RTDA,SANRAL,Highways England,Austroads,NZTA,FHWA,NHAI,Trafikverket,RWS,MLIT,DNIT,GHA,ERA' AS agencies,
    'See RMS > Global Case Studies tab for full analysis' AS navigation`,

  Q23: `-- International standards reference
  SELECT 'Standards' AS category,
    'HDM-4,ISO 55001,SATCC TRH4,World Bank RAMP,AfDB IAMP,AASHTO PP104,FHWA TAMP,Austroads AP-R,PIARC,IRC SP:19' AS standards,
    'See RMS > Standards & Evidence tab for full details' AS navigation`,

  Q24: `-- RMS 5-tier architecture reference
  SELECT tier, description FROM (VALUES
    (1,'Data Collection: ROMDAS, traffic counts, bridge inspection, GPS surveys, ATC'),
    (2,'Data Management: central_network_db, GIS layers, condition database, asset registry'),
    (3,'Analysis & Modelling: HDM-4, ML engine, deterioration models, budget optimisation'),
    (4,'Planning & Programming: NDPIV, OPRC, maintenance planning, budget allocation'),
    (5,'Monitoring & Reporting: dashboards, KPIs, this platform, annual reports')
  ) AS tiers(tier, description)`,
};
