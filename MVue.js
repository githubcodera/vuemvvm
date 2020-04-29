


// class MVue {
//     constructor(options) {
//         this.$el = options.el;
//         this.$data = options.data;
//         this.$options = options;
//         if (this.$el) {
//             //1.实现一个数据观察者Observer
//             //2.实现一个指令解析器:解析$el和v-text等指令
//             new Compile(this.$el, this)
//          在Compile类的构造器中的直接执行函数，这样new ObjClass就执行了函数：this.compile(fragment);this.el.appendChild(fragment);不是执行函数定义。

//         }
//     }
// }

class MVue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        this.$options = options;
        if (this.$el) {
            //1.实现一个数据观察者Observer,观察所有的属性this.$data
            new Observer(this.$data)
            //2.实现一个指令解析器:解析$el和v-text等指令
            new Compile(this.$el, this)
            //在Compile构造器中执行函数：this.compile(fragment);this.el.appendChild(fragment);
            //实现编译过程
            this.proxyData(this.$data)

        }
    }
    proxyData(data){
        for(const key in data){
            //vm.$data代理成this          
             Object.defineProperty(this,key,{
                 get(){
                    //this是 new MVue
                     return data[key]
                 },
                 set(newVal){
                    data[key] = newVal
                 },
             })

        }
    }
}
const compileUtil = {
    getValue(expr, vm) {

        //[person,name] reduce第一个参数是person,第二个参数是name。
        //1.html节点： v-html="name" v-html="person.name"都返回name。
        //2.文本节点{{num}},{{person.num}}都返回num

        // console.log("expr",vm.$data)
        //2.1 reduce传的第一个值是一个方法。
        //2.2 方法里第一个参数data是reduce传的第二个值vm.$data,方法里第二个参数currentValue是数组的第二个值：num或person.num

        // 一个参数是累计值，一个参数是数组的每一个元素 
        //reduce函数的作用：先得到data.person---->到data.person.name
        //currentValue是expr.split('.')
        //add初始值是vm.$data
        // return add[currentValue];reduce是改变数组整体，
        //vm.$data的每一项= add[currentValue] = add[currentValue]
        //数组的每一项 = vm.$data[person] = vm.$data[person][num]
        //data[currentValue]:从expr表达式得到最小表达式currentValue，根据data和最小表达式得到值。
        // return expr.split('.').reduce((add, currentValue) => {
        //     return add[currentValue];
        // }, vm.$data)
        return expr.split('.').reduce((add, currentValue) => {
            return add[currentValue];
        }, vm.$data)
        //vm.$data 已经代理，取值用vm[xxx]，不用vm.$data[xxx]
    },
    setValue(expr,vm,inputVal){ //expr:person.num
        return expr.split('.').reduce((add, currentValue) => {
            //add[currentValue]是原来旧的值，inputVal是新值
            // return add[currentValue];
            add[currentValue] = inputVal
        }, vm.$data)
    },
    getContent(expr, vm) {
        return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getValue(args[1], vm)
        })
    },
    text(node, expr, vm) {
        //文本节点{{num}},{{person.num}}都返回num
        //用msg去取值，一个表达式expr。v-text="msg"  v-text="person.msg"
        // const value = vm.$data[expr];
        //对expr判断，是{{person.num}} {{num}}还是num
        let value;
        //expr  {{person.name}}--{{person.num}}
        if (expr.indexOf('{{') !== -1) { //expr:{{}}--{{}}
            value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
                //args:["{{person.num}}", "person.num", 17, "{{person.name}}--{{person.num}}"]                  
                //args[0]{{person.name}}--{{person.num}}
                //args[1]person.name
                //args[0]{{person.num}}
                //args[1]person.num

                /*args[0],args[1]得到指令表达式-*/
                // console.log("args[0]:", args[0])    //person.name
                // console.log("args[1]:", args[1])     //msg    
                //绑定一个watcher
                new Watcher(vm, args[1], () => {
                    this.updater.textUpdater(node, this.getContent(expr, vm));
                })
                let a = this.getValue(args[1], vm)
                return a
            })
        } else {
            value = this.getValue(expr, vm);
        }
        this.updater.textUpdater(node, value);
    },
    html(node, expr, vm) {
        const value = this.getValue(expr, vm);
        //绑定一个watcher
        new Watcher(vm, expr, (newVal) => {
            this.updater.htmlUpdater(node, newVal);
        })
        //绑定一个watcher
        this.updater.htmlUpdater(node, value);
    },
    model(node, expr, vm) { //处理input输入框时
        const value = this.getValue(expr, vm);
        //绑定更新函数，数据驱动视图
        //绑定观察者 new Watcher,数据发生改变去触发这里的回调进行update更新。
        new Watcher(vm, expr, (newVal) => {
            this.updater.modelUpdater(node, newVal);
        })

        //更新视图，影响了数据，数据更新视图
        node.addEventListener("input",(e)=>{
            //设置值
            this.setValue(expr,vm,e.target.value)
        })
        this.updater.modelUpdater(node, value);
    },
    on(node, expr, vm, eventName) {
        let fn = vm.$options.methods && vm.$options.methods[expr];
        //addEventListener(方法名，方法)
        //保留vm指向,false冒泡
        node.addEventListener(eventName, fn.bind(vm), false)
    },
    bind(node, expr, vm, attrName) {
        //
    },
    updater: {
        textUpdater(node, value) {
            // console.log(value);
            node.textContent = value
        },
        htmlUpdater(node, value) {
            node.innerHTML = value
        },
        modelUpdater(node, value) {
            node.value = value
        }
    }
}
class Compile {
    constructor(el, vm) {
        //2-1 判断el是否是一个元素节点对象，如果是把当前el赋值给compile的el
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
        //    console.log(this.el)

        //2-2 编译子节点。子节点拿出来进行替换，导致页面重绘。
        //解决
        //1 文档碎片放在缓存中。获取文档碎片对象，放入内存中会减少页面的回流和重绘。
        //2 把缓存对象放入到根元素。
        const fragment = this.node2Fragment(this.el);
        // console.log(fragment)
        //页面中元素都在碎片对象中，页面不显示内容。
        //3 编译模板
        this.compile(fragment);

        //2-3 追加子元素到根元素。页面显示内容。
        this.el.appendChild(fragment)

    }
    compile(fragment) {
        //2-2.3编译模板
        //1 获取所有子节点进行遍历， [...childNodes]转成数组
        const childNodes = fragment.childNodes;
        //1.1第一层子节点遍历 
        //1.2递归遍历
        [...childNodes].forEach((child, index) => {
            // // console.log(node)
            if (this.isElementNode(child)) {
                //1.1是元素节点，编译元素节点
                // console.log("元素", child)
                this.compileElement(child)
            } else {
                // console.log("文本", child)
                this.compileText(child)
            }
            if (child.childNodes && child.childNodes) {
                this.compile(child)
            }

        })
    }
    //1.创建文本碎片，循环放入元素。
    node2Fragment(el) {
        //创建文档碎片,把元素循环放入      
        const f = document.createDocumentFragment();
        let firstChild;
        //根元素的第一个元素存在
        while (firstChild = el.firstChild) {
            f.appendChild(firstChild)
        }
        return f;
    }
    //2.判断是否是元素节点
    isElementNode(node) {
        return node.nodeType === 1
    }
    //3.compileElement编译元素节点
    compileElement(node) {
        //  <div v-text="msg"></div>
        const attribites = node.attributes;
        // console.log(attribites);//{0:v-text}
        [...attribites].forEach((attr, index) => {
            // console.log(attr) //v-text,v-html,v-model,v-on:click
            //v-bind:src
            //对v-属性进行解构赋值
            const { name, value } = attr
            if (this.isDirective(name)) {
                //split分割成数组
                const [, directive] = name.split("-");//text,html,model,on:click
                const [dirName, eventName] = directive.split(":")
                // compileUtil[dirName]对不同节点操作
                // console.log(dirName)
                //编译标签：更新数据，数据驱动视图compileUitl["text"],compileUitl["html"],compileUitl["mode"],compileUitl["on"]
                compileUtil[dirName](node, value, this.vm, eventName)
                //删除标签上的指令：编译完成以后页面显示v-text="msg"，需要删除。
                node.removeAttribute("v-" + directive);
            } else if (this.isEventName(name)) {
                //@click="handleClick"
                let [, eventName] = name.split("@");
                compileUtil["on"](node, value, this.vm, eventName)
            }

        })
    }
    //4.compileText编译文本节点：普通文本，{{}},{{}}-{{}}
    compileText(node) {
        // debugger
        //.?所有的，.?+所有的
        var content = node.textContent;
        if (/\{\{(.+?)\}\}/.test(content)) {
            // console.log(content)
            compileUtil['text'](node, content, this.vm)
        }
    }
    //5.判断是否是v-开始的属性
    isDirective(attrName) {
        return attrName.startsWith("v-");
    }
    //6.判断是否是@开始的属性
    isEventName(attrName) {
        return attrName.startsWith("@");
    }

}




//////////////////////////////////////////////////watcher 和observer
// 1.observer拦截所有的属性
//   什么时候关联Dep，什么时候添加Watcher?
// 2.在拦截所有的属性Object.defineProperty的get方法创建Dep，添加Watcher
//   Watcher,在初始化数据渲染时，new Watcher(),把对应的Watcher绑定到对应的Dep的target属性。
//   这样就能拿到对应的Watcher进行添加。
// 3.修改数据时，调用Object.defineProperty的set方法，发现新的值做一个修改，调用dep.notify就会通知Dep.
//   notify中有所有的观察者，对每一个观察者调用watcher的update方法,通知Watcher去更新视图。
//   watcher update拿到新值，callback回调，是new watcher时定义的。
//   而new watcher是在compile的compileUtil编译html(node.expr,vm)时定义的：new Watcher(vm,expr,(newVal)=>{this.updater.htmlUpdater(node,newVal)})
//   回调函数是在编译html时定义的new watcher中定义的，是绑定了的更新函数htmlUpdater(node,newVal)
//   
// 总结：
// 1.页面开始加载渲染，解析指令加载视图，到html：1.更新当前的值，2.创建绑定watcher对数据监听走到对应的watcher方法，回调的是新调用的值
// 2.watcher此时已创建，初始化。在构造器中：this.oldVal = this.getOldVal()
// this就有watcher，绑定对应的每一个Dep中，给一个target属性。
// 3.Dep和Observer拦截属性什么时候关联？
//   获取数据时，observer的defineReactive，拿到Dep用target添加watcher，把dep.target进行关联。这样就把dep和observer关联了。
//   3.1 Dep notify  3.2 Dep：添加所有的watcher
// 4.数据变化时，通知dep notify，找到对应的watcher，更新视图。
// 总结：
// Compile-----------订阅数据变化，绑定更新函数-------------watcher------------->更新视图
//  订阅数据变化，绑定更新函数，在html，text,mode等方法的compileUtil中。绑定watcher。
//  dep在什么时候和observer关联，添加watcher？

//单向绑定已完成。
//5.数据修改，反向修改视图。
//6.vm.$data.person.num --------> this.person.num





//看旧的值和新的值是否有变化，比较有变化则回调回去更新视图。
//取两个值
// class Watcher{
//     constructor(){

//     }
// }
//callback回调函数,在解析指令时对数据进行更新(解析指令完成模板的编译和数据更新的具体操作)
// compileUtil.getValue(expr,vm)根据不同的expr不同处理

//watcher在compile解析指令时进行绑定
////////////////////////////////////////Compile---------订阅数据变化，绑定更新函数Watcher----------Watcher
class Watcher {
    constructor(vm, expr, callback) {
        this.vm = vm;
        this.expr = expr;
        this.callback = callback;
        this.oldVal = this.getOldVal()
    }
    getOldVal() {
        //把当前观察者watcher挂载到Dep实例上。把watcher与Dep收集依赖关联。
        //watcher在new Mve时建立。
        Dep.target = this; //Dep.target是一个watcher对象，watcher对象已有vm,expr,callback,oldVal属性。
        //   console.log("Dep.target",Dep.target) //Watchercallback: (newVal)expr: "htmlStr"oldVal: "mvm"vm: MVue__proto__: Object
        //   console.log("watcher this：",this)
        let oldVal = compileUtil.getValue(this.expr, this.vm)
        Dep.target = null; //Dep.target是一个watcher对象。观察了当前对应的一个，进行操作后删除。否则一直是新增的当前的观察
        return oldVal;
    }
    update() {
        let newVal = compileUtil.getValue(this.expr, this.vm)
        if (newVal !== this.oldVal) {
            this.callback(newVal)
            //值有改变，通知Dep，执行notify，找到watcher的update方法。在update获取新值。通过回调返回出去。
            //watcher-------更新视图--------updater（compileUtil的解析指令中编译）
        }
    }
}
// Dep通知watcher更新
// Dep收集所有的watcher依赖,添加Wacher到Dep集合
class Dep {
    constructor() {
        this.subs = []
    }
    // 1.收集所有的观察者，在Object.defineProperty拦截属性中get所有的属性时，添加watcher,this.subs是一个watcher数组。
    addSub(watcher) {
        this.subs.push(watcher)
    }
    //Dep关联observer拦截属性。defineReactive拦截属性时，可以创建Dep依赖收集器，用Dep添加观察者

    //观察者watcher观察数据。
    // 2.通知观察者去更新，遍历找到对应有变化的数据对应的watcher去更新。
    notify() {
        console.log("通知了观察者", this.subs)
        //值有改变，通知Dep，执行notify，找到watcher的update方法。在update获取新值。通过回调返回出去。
        //watcher-------更新视图--------updater
        this.subs.forEach(w => w.update()) //watcher的update方法
    }
}





class Observer {
    //1.观察数据data：this.observer(data)
    //只针对对象。进行遍历。
    //1.1 defineReactive拦截属性，设置 Object.defineProperty,配置get,set
    //如果直接修改vm.$data.htmlContent="abc",再打印vm.$data.htmlContent,没有get,set。没有Object.defineProperty。
    //没有针对新的值进行观察。所以在set中需要加上this.observer(newVal)。---------测试没有this.observer(newVal)也有get,set方法？
    //set是普通函数，this指向Object.defineProperty,使用箭头函数，把set函数改成箭头函数，箭头函数无this指向，this继续往上找，this指向当前实例。
    // set:(newVal)=>{
    //    this.observer(newVal)
    //      if(newVal !== value){
    //          value= newVal
    //      }
    // } 
    //2.this.defineReactive(data,key,data[key])定义响应方法。
    //3.创建Dep,Dep通知变化给对应的watcher，所以应该先创建watcher,添加到Dep中成为订阅者。
    //问题：什么时候添加watcher，一个属性对应一个watcher。最开始加载数据渲染页面时，就是数据发生变化了，从无到有。
    //get()订阅数据变化时，往Dep中添加观察者。收集每个属性的观察依赖。
    constructor(data) {
        this.observer(data)
    }

    /*构造器外的函数*/
    //1.observer观察数据
    observer(data) {
        if (data && typeof data === "object") {
            //可能的对象格式：第一层属性也是一个对象。
            //也需要监听第二层属性对应值的变化进行set和get设置，进行递归遍历。
            let keyArr = Object.keys(data)
            keyArr.forEach(k => {
                //对每一个属性定义响应方法。
                this.defineReactive(data, k, data[k])
            })
        }
    }

    //2.defineReactive定义拦截属性的方法并监听。

    defineReactive(obj, key, value) {
        this.observer(value)  // 递归遍历如果是一个对象，继续监听。
        const dep = new Dep();
        //拦截属性
        Object.defineProperty(obj, key, {
            enumerable: true,
            configurable: false,
            get() {
                //定义数据变化时，往Dep中addSub添加观察者watcher。初始也是获取值有变化。观察每个属性。
                //什么时候获取观察者
                Dep.target && dep.addSub(Dep.target)//this.subs.push(Dep.target),this.subs是一个数组
                return value; //获取值
            },
            set: (newVal) => {
                //更改变化，通知Dep
                //Observer拦截所有属性-------通知变化------Dep收集集合-------通知变化-------watcher
                this.observer(newVal)
                //值不同做修改。
                if (newVal !== value) {
                    value = newVal
                }
                dep.notify()
            }
        })

    }
}