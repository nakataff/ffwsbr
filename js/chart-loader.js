window.cffLoadChartJS=window.cffLoadChartJS||function(){
    if(window.Chart)return Promise.resolve(window.Chart);
    if(window.__cffChartPromise)return window.__cffChartPromise;
    window.__cffChartPromise=new Promise(function(resolve,reject){
        var script=document.createElement("script");
        script.src="https://cdn.jsdelivr.net/npm/chart.js";
        script.async=true;
        script.onload=function(){resolve(window.Chart)};
        script.onerror=function(){window.__cffChartPromise=null;reject(new Error("Falha ao carregar gráficos"))};
        document.head.appendChild(script);
    });
    return window.__cffChartPromise;
};
