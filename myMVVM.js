/**
 * 给所有对象添加 set、get 访问器属性。
 * js 中的属性分为两种，一种是数据属性，一种是访问器属性。
 * 通过 Object.defineProperty 来定义。
 *
 * mdn 对该方法的描述：https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
 *
 * Invalid property descriptor. Cannot both specify accessors and a value or writable attribute,
 * 无效的属性描述符。不能同时指定访问器和值或可写属性，
 * @param data 要监听的对象
 * @param key 属性名
 * @param val 值，由于属性值可能还是一个对象，所以需要递归
 * @returns {*}
 */
function defineReactive(data, key, val) {
	// 订阅器
	let dep = new Dep();
	// 递归监听所有字段
	observe(val);
	Object.defineProperty(data, key, {
		// value: val, // 属性的值
		// writable: true, // 是否可写
		enumerable: true,	// 是否可以通过 for in 来进行，枚举
		configurable: true, // 是否可以使用 delete 删除
		get() {
			Dep.target && Dep.target.addDep(dep);
			return val;
		},
		set(newVal) {
			console.log(`数据变化：${val} --> ${newVal}`);
			val = newVal;
			dep.notify();
		}
	});
}
/**
 * 监听对象
 * @param data 对象
 */
function observe(data) {
	if (!data || typeof data !== 'object') return;
	// 取出所有的属性，遍历
	Object.keys(data).forEach(key => {
		defineReactive(data, key, data[key]);
	});
}


/**
 * 视图解析器
 * 在创建 MVVM 时，会传进来一个节点
 * 把这个节点中，被 {{}} 包裹的内容替换掉。
 * 为了使创建对象的代码，和对对象的操作的代码，在层次上更加清晰，使用原型来进行添加。
 * @param el 节点
 * @param vm viewModel
 * @constructor
 */
function Compile(el, vm) {
	this.$vm = vm;
	this.$el = this.isElementNode(el)? el: document.querySelector(el);
	if (this.$el) {
		/*
		 把原节点中的所有子节点，取出来之后，经过一系列操作，在重新放回去，就可以刷新节点，不知道为什么。。。。
		 */
		this.$fragment = this.node2Fragment(this.$el);
		this.init();
		this.$el.appendChild(this.$fragment);
	}
}

/*
对解析器的操作。
 */
Compile.prototype = {
	/**
	 * 判断 el 是否是 Element 元素
	 * @param el
	 * @returns {boolean}
	 */
	isElementNode (el) {
		return el.nodeType === 1;
	},

	/**
	 * 判断 el 是否是 Text 一个元素的文本内容或属性
	 * @param el
	 * @returns {boolean}
	 */
	isTextNode: function (el) {
		return el.nodeType === 3;
	},

	/**
	 * 解析节点
	 * 这里只只实现了数据的解析
	 * 并没有实现指令的解析
	 * @param el
	 */
	compileElement (el) {
		let childNodes = el.childNodes;
		// 由于这里使用了箭头函数，所以此时此刻的 this 依然指向 Compile
		Array.from(childNodes).forEach(node => {
			let reg = /{{(.*)}}/;	// 模板表达式，即：{{test}}
			if (this.isElementNode(node)) {
				// 指令一般是写在标签上，解析指令的代码，在这里实现。
			} else if (this.isTextNode(node) && reg.test(node.textContent)) {
				console.log("被{{}}包裹的字段：" + RegExp.$1);
				this.compileText(node, this.$vm, RegExp.$1, "text");
			}

			// 遍历子节点
			if (node.childNodes && node.childNodes.length) {
				this.compileElement(node);
			}
		});
	},

	/*
	 把一个节点转化成 fragment 类型，
	 fragment 为文档对象，为了防止每次给 dom 树中添加任何节点时，都会改变页面的变现，并重新刷新整个页面，从而消耗大量时间。
	 为解决这个问题，可以创建一个文档碎片，先把节点附加在文档碎片上，然后把文档碎片中的内容一次性的添加进网页中。
	  */
	node2Fragment (el) {
		let fragment = document.createDocumentFragment(), child;
		while (child = el.firstChild) fragment.appendChild(child);
		return fragment;
	},

	/**
	 * 初始化方法
	 * 直接编译被转化成的文档碎片
	 */
	init () {
		this.compileElement(this.$fragment);
	},

	/**
	 * 编译被{{}}包裹的内容
	 * @param node 要修改的对象
	 * @param vm viewModel
	 * @param exp viewModel 的 data 中存在的 key 的名称
	 * @param name 为了拼接 updater 中的 key
	 */
	compileText (node, vm, exp, name) {
		let val = getVMVal(vm, exp);
		let updaterFun = updater[name + "Updater"];
		// 第一次解析的时候，需要对网页进行一次渲染，以后通过订阅器发布消息 dep.notify() 来修改
		updaterFun && updaterFun(node, val);
		new Watcher(vm, exp, (value, oldValue) => updaterFun && updaterFun(node, value, oldValue));
	},
};


/*
更新 viewModel 的一堆方法
 */
let updater = {
	textUpdater(node, value) {
		node.textContent = value === undefined? "": value;
	}
};

/**
 * 消息订阅器，每一个 MVVM 对象都要创建一个 Dep 用来保存所有的订阅者，即 watcher
 * @type {number}
 */
let depId = 0;
function Dep() {
	this.id = depId ++;
	this.watchers = [];
}
Dep.prototype = {
	/**
	 * 添加一个订阅者
	 * @param watcher
	 */
	addSub (watcher) {
		this.watchers.push(watcher);
	},
	/**
	 * 通知所有订阅者更新数据
	 */
	notify () {
		console.log(this.watchers);
		this.watchers.forEach(watcher => {
			watcher.update();
		});
	}
};


/**
 * 消息订阅者
 * @param vm viewModel
 * @param exp viewModel 的 data 中存在的 key 的名称
 * @param cb callback
 * @constructor
 */
function Watcher(vm, exp, cb) {
	this.vm = vm;
	this.exp = exp;
	this.cb = cb;
	this.depIds = {}; // 用来存储消息订阅器的 id

	this.value = this.get();
}
/*
订阅者的操作
 */
Watcher.prototype = {
	// 更新数据
	update() {
		this.run();
	},

	/*
	把订阅器添加到订阅者
	同时
	把订阅者添加到订阅器
	为什么要这么做？？？watchers 中有多个订阅器，却只有一个起作用
	防止在订阅器的
	 */
	addDep(dep) {
		if (!this.depIds.hasOwnProperty(dep.id)) {
			dep.addSub(this);
			this.depIds[dep.id] = dep;
		}
	},

	// 更新数据，算是一层封装，不对外暴露这个方法
	run() {
		let value = this.get();
		let oldValue = this.value;
		this.cb(value, oldValue);
	},

	// 获取修改后的 value，通过监听器来获取
	get() {
		Dep.target = this;
		let value = getVMVal(this.vm, this.exp);
		Dep.target = null;
		return value;
	}
};


/**
 * MVVM 构造器
 * @param options 选项
 * @constructor
 */
function MVVM(options) {
	this.$options = options;
	this._data = this.$options.data;

	// 属性代理，实现 vm.xxx -> vm._data.xxx
	Object.keys(this._data).forEach(key => this._proxy(key));

	// 添加 get、set 监听器
	observe(this._data);

	// 解析模板
	new Compile(this.$options.el, this);
}

MVVM.prototype = {
	_proxy(key) {
		Object.defineProperty(this, key, {
			enumerable: true,
			configurable: false,
			get() {
				return this._data[key];
			},
			set(newVal) {
				this._data[key] = newVal;
			}
		});
	}
};

Dep.target = null;

/**
 * 获取 viewModel 中，属性为 exp 的 value
 * 由于 exp 可能出现 a.b.c 这样的字段，不能通过 vmp[exp] 来获取
 * @param vm viewModel
 * @param exp 属性
 * @returns {*}
 */
function getVMVal(vm, exp) {
	let val = vm;
	exp = exp.split(".");
	exp.forEach((k) => val = val[k]);
	return val;
}
