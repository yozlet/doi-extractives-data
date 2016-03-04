(function() {
  'use strict';

  // local alias for region id => name lookups
  var REGION_ID_NAME = eiti.data.REGION_ID_NAME;
  var colorscheme = colorbrewer.GnBu;
  var lightestGreen = '#e6f2e1';
  colorscheme[3][0] = colorscheme[5][0] = colorscheme[7][0] = lightestGreen;

  // our state is immutable!
  var state = new Immutable.Map();
  var rendered = false;
  // this flag indicates whether we're in the middle of a state mutation
  var mutating = false;

  // create references for often-used elements
  var root = d3.select('#revenue');
  var regionSections = root.selectAll('.regions > .region');
  var timeline = root.select('#timeline');

  var getter = eiti.data.getter;
  var formatNumber = eiti.format.commaSeparatedDollars;
  var NULL_FILL = '#f7f7f7';

  // buttons that expand and collapse other elements
  var filterToggle = root.select('button.toggle-filters');

  // get the filters and add change event handlers
  var filters = root.selectAll('.filters [name]')
    // intialize the state props
    .each(function() {
      state = state.set(this.name, this.value);
    })
    .on('change', function() {
      if (mutating) {
        return;
      }
      var prop = this.name;
      var value = this.value;
      mutateState(function(state) {
        return state.set(prop, value);
      });
    });

  // create our data "model"
  var model = createModel();

  // kick off the "app"
  initialize();

  // when the hash changes, update the state
  d3.select(window)
    .on('hashchange', function() {
      if (mutating) {
        return;
      }
      var props = parseHash();
      mutateState(function() {
        return new Immutable.Map(props);
      });
    });

  function initialize() {
    var props = parseHash();

    return mutateState(function(state) {
      return state.merge(props);
    }) || render(state);
  }

  function parseHash() {
    if (!location.hash) {
      return {};
    }
    var hash = location.hash.substr(1);
    return eiti.url.qs.parse(hash);
  }

  function mutateState(fn) {
    mutating = true;
    var old = state;
    state = fn(state);
    if (!Immutable.is(old, state)) {
      if (rendered && stateChanged(old, state, 'group')) {
        state = state.delete('commodity');
      }
      render(state, old);
      location.hash = eiti.url.qs.format(state.toJS());
      mutating = false;
      return true;
    }
    mutating = false;
    return false;
  }

  function render(state, previous) {
    // console.time('render');

    // update the filters
    filters.each(function() {
      this.value = state.get(this.name) || '';
    });

    var region = state.get('region') || 'US';
    var selected = regionSections
      .classed('active', function() {
        return this.id === region;
      })
      .filter('.active');

    var group = state.get('group');
    var commodityFilter = root.select('#commodity-filter')
      .style('display', group ? null : 'none');

    var needsCommodityUpdate = group &&
      (!previous || group !== previous.get('group'));

    if (needsCommodityUpdate) {
      var commodities = getGroupCommodities(group);

      commodities = commodities.toJS();
      if (commodities.length > 1) {
        var select = commodityFilter
          .select('select');
        var options = select
          .selectAll('option.commodity')
          .data(commodities);
        options.exit()
          .remove();
        options.enter()
          .append('option')
            .attr('class', 'commodity');
        options
          .attr('value', identity)
          .text(identity);

        select.property('value', state.get('commodity') || '');
      } else {
        commodityFilter.style('display', 'none');
      }
    }

    updateFilterDescription(state);

    model.on('yearly', function(data) {
      timeline.call(updateTimeline, data, state);
    });

    selected.call(renderRegion, state);
    // console.timeEnd('render');
    rendered = true;
  }

  function renderRegion(selection, state) {
    var regionId = state.get('region') || 'US';
    var fields = getFields(regionId);

    // console.log('loading', regionId);
    // console.time('load');
    model.load(state, function(error, data) {
      // console.timeEnd('load');

      if (error) {
        console.warn('error:', error.status, error.statusText);
        data = [];
      }

      // console.time('render regions');

      var header = selection.select('.region-header');
      if (header.select('*').empty()) {
        header.append('tr')
          .call(createRegionRow);
      }

      var total = d3.sum(data, getter(fields.value));
      header
        .datum({
          value: total,
          properties: {
            name: 'Total'
          }
        })
        .call(updateRegionRow);

      var map = selection.select('eiti-map');
      onMapLoaded(map, function() {
        var subregions = map.selectAll('path.feature');

        switch (regionId) {
          case 'US':
            subregions.on('click.mutate', eventMutator('region', 'id'));
            break;
        }

        var features = subregions.data();

        var dataByFeatureId = d3.nest()
          .key(getter(fields.subregion || fields.region))
          .rollup(function(d) {
            return d3.sum(d, getter(fields.value));
          })
          .map(data);

        var featureId = getter(fields.featureId);
        features.forEach(function(f) {
          var id = featureId(f);
          f.value = dataByFeatureId[id];
        });

        var value = getter('value');
        var values = features.map(value);
        var scale = createScale(values);

        subregions.style('fill', function(d) {
          var v = value(d);
          return v === undefined
            ? NULL_FILL
            : scale(v);
        });

        selection.select('.map-legend')
          .call(updateLegend, scale);

        selection
          .call(updateSubregions, features, scale);

        // console.timeEnd('render regions');
      });
    });
  }

  function onMapLoaded(map, fn) {
    if (map.property('loaded')) {
      return fn.apply(map.node(), map.datum());
    }
    return map.on('load', function() {
      fn.apply(this, arguments);
    });
  }

  function updateSubregions(selection, features, scale) {

    var list = selection.select('.subregions tbody');
    if (list.empty()) {
      // console.warn('no subregions list:', selection.node());
      return;
    }

    features = features.filter(function(d) {
      return !!d.value;
    });

    var items = list.selectAll('tr.subregion')
      .data(features, getter('id'));

    items.exit().remove();
    var enter = items.enter()
      .append('tr')
        .call(createRegionRow);

    items.sort(function(a, b) {
      return d3.descending(a.value, b.value);
    });

    items.select('.color-swatch')
      .style('background-color', function(d) {
        return scale(d.value);
      });

    items.call(updateRegionRow);
  }

  function createRegionRow(selection) {
    selection
      .attr('class', 'subregion');
    var title = selection.append('td')
      .attr('class', 'subregion-name');
    title.append('span')
      .attr('class', 'color-swatch');
    title.append('span')
      .attr('class', 'text');

    selection.append('td')
      .attr('class', 'value');
    selection.append('td')
      .attr('class', 'bar')
      .append(function() {
        return new EITIBar(); // jshint ignore:line
      });
  }

  function isOffshore(regionObj, returnBool) {
    var region = returnBool ? regionObj : regionObj.id;
    switch (region) {
      case 'alaska':
        return 'Offshore Alaska';
      case 'pacific':
        return 'Pacific Ocean';
      case 'atlantic':
        return 'Atlantic Ocean';
      case 'gulf':
        return 'Gulf of Mexico';
      default:
        return returnBool
          ? false
          : regionObj.properties.name || '(' + regionObj.id + ')';
    }
  }

  function updateRegionRow(selection) {
    selection.select('.subregion-name .text')
      .text(function(f) {
        return isOffshore(f);
      });

    var value = getter('value');
    var values = selection.data()
      .map(value)
      .sort(d3.ascending);

    var extent = d3.extent(values);
    var min = Math.min(0, extent[0]);
    var max = extent[1];

    selection.select('.value')
      .text(function(d) {
        return formatNumber(d.value);
      });

    selection.select('eiti-bar')
      .attr('min', min)
      .attr('max', max)
      .attr('value', getter('value'));
  }

  function createScale(values) {
    var extent = d3.extent(values);
    var min = extent[0];
    var max = Math.max(extent[1], 0);

    var colors = colorscheme;

    if (max >= 2e9) {
      colors = colors[7];
    } else if (max >= 1e6) {
      colors = colors[5];
    } else {
      colors = colors[3];
    }

    var domain = (min < 0)
      ? [Math.min(min, 0), max]
      : [0, max];

    domain = d3.scale.linear()
      .domain(domain)
      .nice()
      .domain();

    return d3.scale.quantize()
      .domain(domain)
      .range(colors);
  }

  function updateLegend(legend, scale) {
    var domain = scale.domain();
    if (domain.some(isNaN)) {
      legend.classed('legend-invalid', true);
      return;
    }

    legend.classed('legend-invalid', false);

    var data = scale.range().map(function(y) {
        return {
          color: y,
          range: scale.invertExtent(y)
        };
      });

    data.unshift({
      color: NULL_FILL,
      range: ['no data'],
      none: true
    });

    var last = data.length - 1;

    var steps = legend.selectAll('.step')
      .data(data);

    steps.exit().remove();
    steps.enter().append('div')
      .attr('class', 'step')
      .append('span')
        .attr('class', 'label');

    var format = eiti.format.shortDollars;
    steps
      .style('border-color', getter('color'))
      .attr('title', function(d) {
        return d.range
          .map(Math.round)
          .join(' to ');
      })
      .select('.label')
        .text(function(d, i) {
          return d.none
            ? d.range[0]
            : i === last
              ? format(d.range[0]) + '+'
              : format(d.range[0]);
        });
  }

  function getGroupCommodities(group) {
    var commodities = eiti.commodities.groups[group].commodities;
    return new Immutable.Set(commodities);
  }

  function getFields(regionId) {
    var fields = {
      region: 'Region',
      value: 'Revenue',
      featureId: 'id'
    };
    if (!regionId) {
      return fields;
    }
    switch (regionId.length) {
      case 2:
        if (regionId !== 'US') {
          fields.region = 'FIPS';
          fields.featureId = function(f) {
            return f.properties.FIPS;
          };
        }
        break;

      // offshore regions
      default:
        fields.subregion = 'Area';
        fields.featureId = function(d) {
          return d.properties.name;
        };
        break;
    }
    return fields;
  }

  function updateTimeline(selection, data, state) {
    var fields = getFields(state.get('region'));

    var value = getter(fields.value);
    var dataByYearPolarity = d3.nest()
      .key(function(d) {
        return value(d) < 0 ? 'negative' : 'positive';
      })
      .key(getter('Year'))
      .rollup(function(d) {
        return d3.sum(d, value);
      })
      .map(data);

    // console.log('data by year/polarity:', dataByYearPolarity);
    var positiveYears = dataByYearPolarity.positive || {};
    var positiveExtent = d3.extent(d3.values(positiveYears));
    var negativeYears = dataByYearPolarity.negative || {};
    var negativeExtent = d3.extent(d3.values(negativeYears));

    // get the slider to determine the year range
    var slider = root.select('#year-selector').node();

    // XXX: d3.range() is exclusive, so we need to add two
    // in order to include the last year *and* make the area render the right
    // edge of the last year.
    var years = d3.range(slider.min, slider.max + 2, 1);

    var w = 500;
    var h = 40;
    var viewBox = selection.attr('viewBox');
    // if there is a viewBox already, derive the dimensions from it
    if (viewBox) {
      viewBox = viewBox.split(' ').map(Number);
      w = viewBox[2];
      h = viewBox[3];
    } else {
      // otherwise, set up the viewBox with our default dimensions
      selection.attr('viewBox', [0, 0, w, h].join(' '));
    }

    var left = 0; // XXX need to make room for axis labels
    var right = w;

    // the x-axis scale
    var x = d3.scale.linear()
      .domain(d3.extent(years))
      .range([left, right + 2]);

    // the y-axis domain sets a specific point for zero.
    // the `|| -100` and `|| 100` bits here ensure that the domain has some
    // size, even if there is no data from which to derive an extent.
    var yDomain = [
      negativeExtent[0] || 0,
      positiveExtent[1] || 100
    ];
    // the y-axis scale, with the zero point at 3/4 the height
    // XXX: note that this exaggerates the negative scale!
    var y = d3.scale.linear()
      .domain(yDomain)
      .range([h, 0]);

    var area = d3.svg.area()
      .interpolate('step-after')
      .x(function(d) { return x(d.year); })
      .y0(y(0))
      .y1(function(d) { return y(d.value); });

    var areas = selection.selectAll('path.area')
      .data([
        {
          polarity: 'positive',
          values: years.map(function(year) {
            return {
              year: year,
              value: positiveYears[year] || 0
            };
          })
        },
        {
          polarity: 'negative',
          values: years.map(function(year) {
            return {
              year: year,
              value: negativeYears[year] || 0
            };
          })
        }
      ]);

    areas.exit().remove();
    areas.enter().append('path')
      .attr('class', function(d) {
        return 'area ' + d.polarity;
      });

    var zero = selection.select('g.zero');
    if (zero.empty()) {
      zero = selection.append('g')
        .attr('class', 'zero');
      zero.append('line');
      zero.append('text')
        .attr('class', 'label')
        .attr('text-anchor', 'end')
        .attr('dy', 0.5);
        // .text(0);
    }

    var mask = selection.select('g.mask');
    if (mask.empty()) {
      mask = selection.append('g')
        .attr('class', 'mask');
      mask.append('rect')
        .attr('class', 'before')
        .attr('x', 0)
        .attr('width', 0)
        .attr('height', h);
      mask.append('rect')
        .attr('class', 'after')
        .attr('x', w)
        .attr('width', w)
        .attr('height', h);
      mask.append('line')
        .attr('class', 'before')
        .attr('y1', 0)
        .attr('y2', h);
      mask.append('line')
        .attr('class', 'after')
        .attr('y1', 0)
        .attr('y2', h);
    }

    var updated = selection.property('updated');
    var t = function(d) { return d; };
    if (updated) {
      t = function(d) {
        return d.transition()
          .duration(500);
      };
    }

    var year1 = slider.value;
    var year2 = slider.value + 1;
    var beforeX = x(year1);
    var afterX = Math.min(x(year2), w);
    // don't transition these
    mask.select('rect.before')
      .attr('width', beforeX);
    mask.select('rect.after')
      .attr('x', afterX);
    mask.select('line.before')
      .attr('transform', 'translate(' + [beforeX, 0] + ')');
    mask.select('line.after')
      .attr('transform', 'translate(' + [afterX, 0] + ')');

    // transition these
    // mask = t(mask);
    mask.selectAll('line')
      .attr('y1', y(positiveYears[year1] || 0))
      .attr('y2', y(negativeYears[year1] || 0));

    zero.select('line')
      .attr('x1', left)
      .attr('x2', right);

    zero.select('.label')
      .attr('transform', 'translate(' + [left, 0] + ')');

    t(zero).attr('transform', 'translate(' + [0, y(0)] + ')');

    t(areas).attr('d', function(d) {
      return area(d.values);
    });
    selection.property('updated', true);
  }

  function createModel() {
    var model = {};
    var dispatch = d3.dispatch('yearly');
    var req;
    var previous;

    model.load = function(state, done) {
      if (req) {
        req.abort();
      }
      var url = getDataURL(state);
      // console.log('model.load():', url);
      req = eiti.load(url, function(error, data) {
        if (error) {
          data = [];
        }
        applyFilters(data, state, done);
      });
      return req;
    };

    function getDataURL(state) {
      var region = state.get('region');
      var path = eiti.data.path;
      path += (!region || region === 'US')
        ? 'regional/'
        : region.length === 2
          ? 'county/by-state/' + region + '/'
          : 'offshore/';
      return path + 'revenues.tsv';
    }

    function applyFilters(data, state, done) {
      // console.log('applying filters:', state.toJS());

      var commodity = state.get('commodity');
      var group = state.get('group');
      if (commodity) {
        data = data.filter(function(d) {
          return d.Commodity === commodity;
        });
      } else if (group) {
        var commodities = getGroupCommodities(group);
        data = data.filter(function(d) {
          return commodities.has(d.Commodity);
        });
      }

      var region = state.get('region');
      if (region && region.length !== 2) {
        var fields = getFields(region);
        var regionName = REGION_ID_NAME[region];
        data = data.filter(function(d) {
          return d[fields.region] === regionName;
        });
      }

      dispatch.yearly(data);

      var year = state.get('year');
      if (year) {
        data = data.filter(function(d) {
          // XXX jshint ignore
          return d.Year == year;
        });
      }

      // console.log('filtered to %d rows', data.length);
      previous = state;

      return done(null, data);
    }

    return d3.rebind(model, dispatch, 'on');
  }

  function updateFilterDescription(state) {
    var desc = root.selectAll('[data-filter-description]');

    var commodity = state.get('commodity') ||
      (state.get('group')
       ? eiti.commodities.groups[state.get('group')].name
       : 'all commodities');

    var data = {
      commodity: commodity.toLowerCase(),
      region: isOffshore(state.get('region'), true) || REGION_ID_NAME[state.get('region') || 'US'],
      year: state.get('year')
    };

    desc.selectAll('[data-key]')
      .text(function() {
        return data[this.getAttribute('data-key')];
      });
  }

  function eventMutator(destProp, sourceKey) {
    sourceKey = getter(sourceKey);
    return function(d) {
      var value = sourceKey(d);
      mutateState(function(state) {
        return state.set(destProp, value);
      });
      d3.event.preventDefault();
    };
  }

  function stateChanged(old, state, key) {
    var prev = old.get(key) || '';
    var next = state.get(key) || '';
    return prev !== next;
  }

  function identity(d) {
    return d;
  }

})(this);
