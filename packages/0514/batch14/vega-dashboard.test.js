import { compile } from 'vega-lite';

const mockData = [
  { x: 10, y: 20, category: 'A', value: 30 },
  { x: 15, y: 25, category: 'B', value: 35 },
  { x: 20, y: 30, category: 'A', value: 40 },
  { x: 25, y: 35, category: 'C', value: 45 },
  { x: 30, y: 40, category: 'B', value: 50 }
];

function createSpec(data, theme = 'light') {
  return {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "data": { "values": data },
    "params": [
      {
        "name": "brush",
        "select": { "type": "interval", "encodings": ["x", "y"] }
      },
      {
        "name": "categorySelect",
        "select": { "type": "point", "fields": ["category"] }
      }
    ],
    "hconcat": [
      {
        "title": "散点图",
        "mark": "point",
        "transform": [{
          "filter": { "param": "categorySelect" }
        }],
        "encoding": {
          "x": { "field": "x", "type": "quantitative" },
          "y": { "field": "y", "type": "quantitative" },
          "color": {
            "condition": {
              "param": "brush",
              "field": "category",
              "type": "nominal"
            },
            "value": "grey"
          }
        },
        "width": 300,
        "height": 200
      },
      {
        "title": "柱状图",
        "transform": [{
          "filter": { "param": "brush" }
        }],
        "mark": "bar",
        "params": [{
          "name": "categorySelect",
          "select": { "type": "point", "encodings": ["color"] }
        }],
        "encoding": {
          "x": { "field": "category", "type": "nominal" },
          "y": { "aggregate": "count", "type": "quantitative" },
          "color": { "field": "category", "type": "nominal" }
        },
        "width": 300,
        "height": 200
      }
    ]
  };
}

describe('Vega-Lite Dashboard Tests', () => {
  test('should compile Vega-Lite spec without errors', () => {
    const spec = createSpec(mockData);
    const compiled = compile(spec);
    expect(compiled).toBeDefined();
    expect(compiled.spec).toBeDefined();
    expect(compiled.spec).not.toBeNull();
  });

  test('spec should contain both brush and categorySelect parameters at top level', () => {
    const spec = createSpec(mockData);
    expect(spec.params).toBeDefined();
    expect(spec.params.length).toBe(2);
    
    const brushParam = spec.params.find(p => p.name === 'brush');
    const categoryParam = spec.params.find(p => p.name === 'categorySelect');
    
    expect(brushParam).toBeDefined();
    expect(brushParam.select.type).toBe('interval');
    
    expect(categoryParam).toBeDefined();
    expect(categoryParam.select.type).toBe('point');
  });

  test('scatterplot should filter by categorySelect param', () => {
    const spec = createSpec(mockData);
    const scatterplot = spec.hconcat[0];
    
    expect(scatterplot.transform).toBeDefined();
    expect(scatterplot.transform[0].filter.param).toBe('categorySelect');
  });

  test('barchart should filter by brush param and have categorySelect param', () => {
    const spec = createSpec(mockData);
    const barchart = spec.hconcat[1];
    
    expect(barchart.transform).toBeDefined();
    expect(barchart.transform[0].filter.param).toBe('brush');
    
    expect(barchart.params).toBeDefined();
    expect(barchart.params[0].name).toBe('categorySelect');
    expect(barchart.params[0].select.type).toBe('point');
  });

  test('should have correct data fields in encoding', () => {
    const spec = createSpec(mockData);
    const scatterplot = spec.hconcat[0];
    const barchart = spec.hconcat[1];
    
    expect(scatterplot.encoding.x.field).toBe('x');
    expect(scatterplot.encoding.x.type).toBe('quantitative');
    expect(scatterplot.encoding.y.field).toBe('y');
    expect(scatterplot.encoding.y.type).toBe('quantitative');
    
    expect(barchart.encoding.x.field).toBe('category');
    expect(barchart.encoding.x.type).toBe('nominal');
    expect(barchart.encoding.y.aggregate).toBe('count');
    expect(barchart.encoding.y.type).toBe('quantitative');
  });

  test('compiled spec should contain signals for interaction', () => {
    const spec = createSpec(mockData);
    const compiled = compile(spec);
    
    const signals = compiled.spec.signals || [];
    expect(signals.length).toBeGreaterThan(0);
    
    const signalNames = signals.map(s => s.name);
    expect(signalNames.some(name => name.includes('brush'))).toBe(true);
    expect(signalNames.some(name => name.includes('categorySelect'))).toBe(true);
  });

  test('compiled spec should have scales configuration', () => {
    const spec = createSpec(mockData);
    const compiled = compile(spec);
    
    const scales = compiled.spec.scales || [];
    expect(scales.length).toBeGreaterThan(0);
    
    const xScales = scales.filter(s => s.name.includes('x'));
    const yScales = scales.filter(s => s.name.includes('y'));
    const colorScales = scales.filter(s => s.name.includes('color'));
    
    expect(xScales.length).toBeGreaterThan(0);
    expect(yScales.length).toBeGreaterThan(0);
    expect(colorScales.length).toBeGreaterThan(0);
  });

  test('compiled spec should contain data flow configuration', () => {
    const spec = createSpec(mockData);
    const compiled = compile(spec);
    
    const dataSets = compiled.spec.data || [];
    expect(dataSets.length).toBeGreaterThan(0);
    
    const sourceData = dataSets.find(d => d.name === 'source_0');
    expect(sourceData).toBeDefined();
    expect(sourceData.values).toEqual(mockData);
  });

  test('both charts should share the same color scale for cross filtering', () => {
    const spec = createSpec(mockData);
    const scatterColor = spec.hconcat[0].encoding.color;
    const barColor = spec.hconcat[1].encoding.color;
    
    expect(scatterColor.condition.field).toBe('category');
    expect(barColor.field).toBe('category');
    expect(scatterColor.condition.type).toBe('nominal');
    expect(barColor.type).toBe('nominal');
  });

  test('brush selection should be bound to x and y encodings', () => {
    const spec = createSpec(mockData);
    const brushParam = spec.params.find(p => p.name === 'brush');
    
    expect(brushParam.select.encodings).toContain('x');
    expect(brushParam.select.encodings).toContain('y');
  });
});
