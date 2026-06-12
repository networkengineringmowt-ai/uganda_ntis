<?xml version="1.0" encoding="UTF-8"?>
<!-- UGROADS — road network styled by class (A cyan / B green / C amber / M violet)
     Import in GeoServer: Styles -> Add -> upload, then assign to core.network_links -->
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc">
  <NamedLayer><Name>network_class</Name><UserStyle><FeatureTypeStyle>
    <Rule><Name>Class A</Name>
      <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>road_class</ogc:PropertyName><ogc:Literal>A</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
      <LineSymbolizer><Stroke><CssParameter name="stroke">#00f5ff</CssParameter><CssParameter name="stroke-width">2.4</CssParameter></Stroke></LineSymbolizer>
    </Rule>
    <Rule><Name>Class B</Name>
      <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>road_class</ogc:PropertyName><ogc:Literal>B</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
      <LineSymbolizer><Stroke><CssParameter name="stroke">#00ff88</CssParameter><CssParameter name="stroke-width">1.8</CssParameter></Stroke></LineSymbolizer>
    </Rule>
    <Rule><Name>Class C</Name>
      <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>road_class</ogc:PropertyName><ogc:Literal>C</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
      <LineSymbolizer><Stroke><CssParameter name="stroke">#ffd23f</CssParameter><CssParameter name="stroke-width">1.1</CssParameter></Stroke></LineSymbolizer>
    </Rule>
    <Rule><Name>Class M</Name>
      <ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>road_class</ogc:PropertyName><ogc:Literal>M</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>
      <LineSymbolizer><Stroke><CssParameter name="stroke">#b967ff</CssParameter><CssParameter name="stroke-width">2.8</CssParameter></Stroke></LineSymbolizer>
    </Rule>
  </FeatureTypeStyle></UserStyle></NamedLayer>
</StyledLayerDescriptor>
