import {bindable, inject, computedFrom, customElement, bindingMode} from "aurelia-framework";
import {resolvedView} from "aurelia-view-manager";
import {EntityManager} from "aurelia-orm";
import {Router} from "aurelia-router";
import {Statham} from "json-statham";

@customElement('datatable')
@resolvedView('spoonx/datatable', 'datatable')
@inject(Router, Element, EntityManager)
export class DataTable {
  @bindable({defaultBindingMode: bindingMode.twoWay})
  criteria = {};

  @bindable({defaultBindingMode: bindingMode.twoWay})
  where = {};

  @bindable limit        = 30;
  @bindable columns      = '';
  @bindable searchColumn = 'name';
  @bindable searchable   = null;  // Show the search field? (Optional attribute).
  @bindable sortable     = null;  // Columns can be sorted? (Optional attribute).
  @bindable edit         = null;  // Rows are editable? (Optional attribute).
  @bindable destroy      = null;  // Rows are removable? (Optional attribute).
  @bindable page         = 1;     // Current page.
  @bindable populate     = false; // Which columns to populate. True for all, string for specific.
  @bindable select;               // User provided callback, called upon clicking on a row.
  @bindable repository;
  @bindable resource;
  @bindable data;
  @bindable route;
  @bindable pages;
  @bindable actions = [];

  constructor(Router, element, entityManager) {
    this.router        = Router;
    this.element       = element;
    this.entityManager = entityManager;
  }

  attached() {
    if (!this.repository && this.resource) {
      this.repository = this.entityManager.getRepository(this.resource);
    }

    this.ready          = true;
    this.criteria.where = this.where;
    this.criteria.sort  = this.criteria.sort || {};

    this.load();
  }

  detached() {
    this.ready = false;
  }

  pageChanged() {
    this.load();
  }

  limitChanged() {
    this.load();
  }

  load() {
    this.criteria.skip  = this.page * this.limit - this.limit;
    this.criteria.limit = this.limit;

    if (!this.populate) {
      this.criteria.populate = null;
    } else if (typeof this.criteria.populate === 'string') {
      this.criteria.populate = this.populate;
    }

    this.repository.find(this.criteria, true).then(result => {
      this.data = result;
    }).catch(error => {
      this.triggerEvent('exception', {on: 'load', error: error});
    });
  }

  populateEntity(row) {
    return this.repository.getPopulatedEntity(row);
  }

  doDestroy(row) {
    if (typeof this.destroy === 'function') {
      return this.destroy(row);
    }

    this.populateEntity(row).destroy().then(() => {
      this.load();
      this.triggerEvent('destroyed', row);
    }).catch(error => {
      this.triggerEvent('exception', {on: 'destroy', error: error});
    });
  }

  doEdit(row) {
    if (typeof this.edit === 'function') {
      return this.edit(row);
    }
  }

  doCustomAction(action, row) {
    if (typeof action.action === 'function') {
      return action.action(row);
    }
  }

  checkDisabled(action, row) {
    console.log('ONE', row);
    if (typeof action.disabled === 'function') {
      console.log('TWO');
      return action.disabled(row);
    }
    return false;
  }

  doSort(columnLabel) {
    if (this.sortable === null || columnLabel.column.indexOf('.') !== -1) {
      return;
    }

    let column = columnLabel.column;

    this.criteria.sort = {
      [column]: this.criteria.sort[column] === 'asc' ? 'desc' : 'asc'
    };

    this.load();
  }

  searchColumnChanged(newValue, oldValue) {
    if (!this.ready) {
      return;
    }

    delete this.criteria.where[oldValue];

    return this.doSearch();
  }

  doSearch() {
    if (!this.ready) {
      return;
    }

    if (typeof this.criteria.where[this.searchColumn] === 'object') {
      this.criteria.where[this.searchColumn].contains = this.search;
    } else {
      this.criteria.where[this.searchColumn] = {contains: this.search};
    }

    if (!this.ready) {
      return;
    }

    this.pager.reloadCount();

    this.load();
  }

  reload() {
    this.pager.reloadCount(); // sets page to 1, and triggers this.pageChanged() (reload data).

    if (this.page === 1) {
      this.load(); // this.pageChanged() won't trigger if the current page is already page 1.
    }
  }

  @computedFrom('columns')
  get columnLabels() {
    let labelsRaw    = this.columns.split(',');
    let columnsArray = [];
    let labels       = [];

    function clean(str) {
      return str.replace(/^'?\s*|\s*'$/g, '');
    }

    function ucfirst(str) {
      return str[0].toUpperCase() + str.substr(1);
    }

    labelsRaw.forEach(label => {
      if (!label) {
        return;
      }

      let aliased       = label.split(' as ');
      let cleanedColumn = clean(aliased[0]);

      if (columnsArray.indexOf(cleanedColumn) === -1) {
        columnsArray.push(cleanedColumn);
      }

      labels.push({
        nested: cleanedColumn.indexOf('.') !== -1,
        column: cleanedColumn,
        label : ucfirst(clean(aliased[1] || aliased[0]))
      });
    });

    return labels;
  }

  triggerEvent(event, payload = {}) {
    payload.bubbles = true;

    return this.element.dispatchEvent(new CustomEvent(event, payload));
  }

  selected(row) {
    if (this.route) {
      return this.router.navigateToRoute(this.route, {id: row.id})
    }

    if (this.select) {
      return this.select(row);
    }
  }

  displayValue(row, propertyName) {
    return new Statham(row, Statham.MODE_NESTED).fetch(propertyName);
  }
}
