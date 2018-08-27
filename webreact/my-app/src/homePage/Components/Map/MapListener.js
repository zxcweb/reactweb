import $ from 'jquery';
//添加自定义组件
import simpleFeature from '../../../Basic/Map/Geometry/SimpleFeature';
import htmlTemplate from '../../../Basic/Map/Popup/HtmlTemplate';
import toolMap from '../../../Basic/Map/Other/ToolMap';
import portAndBerthServer from '../../../axios/portAndBerthServer';
import mapEvent from "../../../Basic/Tool/event/MapEvent";
import Straitserver from '../../../axios/straitserver';
import simplePolygon from '../../../Basic/Map/Geometry/simplePolygon'
import lineHtmlTemplate from '../../../Basic/Map/Geometry/LineHtmlTemplate';
import simpleLine from '../../../Basic/Map/Geometry/SimpleLine';
import shipDataLayer from './ShipDataLayer';
import simpleLayer from '../../../Basic/Map/Layer/SimpleLayer';
import seaareaServer from '../../../axios/seaareaServer';
import GPS from '../../../Basic/Map/Other/geotrans';
import dischargeServer from '../../../axios/dischargeServer';

import dischargetemplate from '../../../Basic/Map/Geometry/dischargetemplate';

class MapListener {
    constructor(state) {
        this.mapObj = state;
        state.map.on('click', (this.clickSouth.bind(this)));
        state.map.on('moveend', (this.moveEnd.bind(this)));
        state.map.addControl(mapEvent.MousePosition());
        this.loadInportentPort();
        this.loadAllPort();
        this.loadStrait();
        this.loadRelation();
        this.shipDataLayer = new shipDataLayer(state.map, state.straitsource);
        this.berthLayer = null;
        this.loadSeaArea();
        this.loadDischarge();
        this.loadChinaDischarge();
        this.clickSouth = null;
    }
    //加载重要港口信息
    loadInportentPort(){
        var self = this;
        //加载全球港口数据
        portAndBerthServer.loadInportentPort({}, function (data) {
            data.data.map((item) => {
                var disInfo = htmlTemplate.createIndexPortTemplate(item);
                var coord = toolMap.transform(item.longitudedecimal, item.latitudeDecimal);
                simpleFeature.createAndAddPortPointFeature(self.mapObj.portInportentSource, "shipleavingport", disInfo, coord, item.portid);
            });
        });
    }

    /***
     * 将全球港口的信息，添加到地图
     */
    loadAllPort() {
        var self = this;
        //加载全球港口数据
        portAndBerthServer.loadAllPort({}, function (data) {
            //"portid":10003,"portname":"Funafuti","country":"Tuvalu","latitudedecimal":-8.516666412,"longitudedecimal":179.216666666,"countrycode":"TUV"}
            data.data.data.forEach((item) => {
                var disInfo = htmlTemplate.createIndexPortTemplate(item);
                var coord = toolMap.transform(item.longitudedecimal, item.latitudedecimal);
                simpleFeature.createAndAddPortPointFeature(self.mapObj.portSource, "shipleavingport", disInfo, coord, item.portid);
            });
        });
    }

    /***
     * 加载全球海峡数据
     */
    loadStrait() {
        var self = this;
        //加载全球海峡数据
        Straitserver.loadallstrait({}, function (data) {
            if (!data) {
                return "";
            }
            data.data.forEach((item) => {/* 循环取数据 */
                var lonlat = item.centPos;
                var lonlatdes = lonlat.substring(lonlat.indexOf("(") + 1, lonlat.indexOf(")"));
                var lonlatfin = lonlatdes.split("\s");
                //中心点
                var centerPoint = lonlatfin[0].split(" ");
                var coord =  toolMap.transform(Number(centerPoint[0]), Number(centerPoint[1]));
                var disInfo = htmlTemplate.createIndexStraitTemplate(item);
                simpleFeature.createAndAddStraitPointFeature(self.mapObj.straitsource, "strait", disInfo, coord,item.name);
                var area = item.regionText.split('|');
                var arr = [];
                area.forEach((item) => {
                    var areaan = item.split(',');
                    var coord = toolMap.transform(areaan[0], areaan[1]);
                    arr.push(coord);

                });
                simplePolygon.createAndAddMap(self.mapObj.straitsource, 50, arr, 'indexStrait');

            })
        })
    }

    /* 增加海区内容,将原始数据保存在public的json文件夹下，用于脚手架编译的访问 */
    loadSeaArea() {
        let self = this;
        seaareaServer.loadAllSeaarea({}, function (data) {

            data.forEach((item) => {
                let disInfo = htmlTemplate.createIndexTemplate1(item.name);
                let seaarea = item.multiGeometry;
                let border = seaarea.multiGeometry;
                let outlineborder = border[0].outerBoundaryIs[0].coordinates;
                let arr = [];
                let seaareaborder = outlineborder.split(',');
                for (var i = 0; i < seaareaborder.length; i++) {
                    var arrcode = [seaareaborder[i], seaareaborder[++i]];
                    var seaoutlinespot = GPS.gcj_encrypt(arrcode[0], arrcode[1])
                    var coord = toolMap.transform(seaoutlinespot[0], seaoutlinespot[1]);
                    arr.push(coord);
                }
                simplePolygon.createAndAddMap1(self.mapObj.seaareaSource, 50, arr, 'indexSeaArea', disInfo);
            })


        })

    }

    /*增加排放区内容,将原始数据保存在public的json文件夹下，用于脚手架编译后访问*/
    loadDischarge() {
        let self = this;
        dischargeServer.loadAlldisCharge({}, function (data) {
            data.forEach((item) => {
                let area = item.area[0];
                let disarea = area.line;
                for (var i = 0; i < disarea.length;) {
                    let disInfo = htmlTemplate.createIndexTemplate1(item.name);
                    let lon = disarea[i].lon;
                    let lat = disarea[i].lat;
                    var next = ++i;
                    if (!disarea[next]) {//判断最后为基数个点的时候，直接返回不用再加入点集内
                        return;
                    }
                    let lon1 = disarea[next].lon;
                    let lat1 = disarea[next].lat;
                    let frompoint = toolMap.transform(lon, lat);
                    let topoint = toolMap.transform(lon1, lat1);
                    simpleLine.createAndAddSourceLine(disInfo, self.mapObj.dischargeSource, frompoint, topoint, 'lineChoose', '全球排放点内容');

                }
            })
        })
    }


    /*
    增加中国排放区内容，数据同样保存在public下面
    */
    loadChinaDischarge() {
        let self = this;
        dischargeServer.loadChinadischarge({}, function (data) {
            data.forEach((item) => {

                let detaildata = item.data;
                let len = detaildata.length;
                for (var i = 0; i < len;) {
                    let disInfo = htmlTemplate.createIndexTemplate1(item.name)
                    let lon = detaildata[i].lon;
                    let lat = detaildata[i].lat;
                    var desplus = ++i;
                    if (!detaildata[desplus]) {
                        return;
                    }
                    let lon1 = detaildata[desplus].lon;
                    let lat1 = detaildata[desplus].lat;
                    let frompoint = toolMap.transform(lon, lat);
                    let topoint = toolMap.transform(lon1, lat1);
                    simpleLine.createAndAddSourceLine(disInfo, self.mapObj.ChinadischargeSource, frompoint, topoint, 'dischargeLine', '中国地区排放');
                }
            })

        })

    }

    /***
     * 加载港口之间的关系网络图
     */
    loadRelation() {
        let self = this;
        portAndBerthServer.loadStraitRelation(function (data) {

            //加载所有的港口
           /* data.portGird.map((item) => {
                var disInfo = lineHtmlTemplate.relationTemplate(item);
                var coord = toolMap.transform(item.longitudedecimal, item.latitudeDecimal);

                simpleFeature.createAndAddPointFeature(self.mapObj.relationSource, "shipleavingport", disInfo, coord);
            });*/
            //添加关系网络线
            data.relation.map((item) => {
                let disInfo = lineHtmlTemplate.relationTemplate(item);
                let fromPoint = toolMap.transform(item.startlog, item.startlat);
                let toPoint = toolMap.transform(item.endlog, item.endlat);
                simpleLine.createAndAddSourceLine(disInfo, self.mapObj.relationSource, fromPoint, toPoint, "portline", "关系网络线");
            })
        });
    }

    /* 增加弹窗出现的基本内容 点击港口图标显示港口标牌——————————————————————————————————————————————————————————*/
    clickSouth(evt) {
        var self = this;
        var coordinate = evt.coordinate;
        /* 声明点击后的坐标 */
        self.clickSouth = coordinate;
        var pixel = self.mapObj.map.getEventPixel(evt.originalEvent);
        var feature = self.mapObj.map.forEachFeatureAtPixel(pixel, function (feature, layer) {
            if (layer == self.mapObj.portLayer || layer == self.mapObj.portInportentLayer || layer == self.mapObj.shipLayer) {
                //点击港口
                self.portClick(feature, layer, self.mapObj.popupOverlay.getElement(), self.mapObj.popupOverlay);
                return "not todo";
            } else if (layer == self.mapObj.seaareaLayer) {
                //点击海区
                self.portClick1(feature, layer, self.mapObj.popupOverlay.getElement(), self.mapObj.popupOverlay);
                return "not todo";
            } else if (layer == self.mapObj.berthLayer) {
                //点击泊位
                self.berthClick(feature, layer, self.mapObj.popupOverlay.getElement(), self.mapObj.popupOverlay, coordinate);
                return "not todo";
            }else if(layer == self.mapObj.straitlayer){
                //点击海峡
                self.portClick(feature, layer, self.mapObj.popupOverlay.getElement(), self.mapObj.popupOverlay);
                console.log("海峡名称："+feature.get('name'));
                return "not todo";
            }
        })
        if (feature == null) {
            self.mapObj.popupOverlay.setPosition(undefined);
            $("#popup-content").html("");
            $("#popup").removeClass('popup-seaarea');
        }
    }

    //出现弹窗
    portClick(feature, layer, element, popLayer) {
        var self = this;
        var portId = feature.get('portId');
        $("#popup-content").html(feature.get('disInfo'));
        popLayer.setPosition(feature.getGeometry().getCoordinates());
        $("#popup").removeClass('popup-seaarea');
        if (portId) {
            var berthSource = self.mapObj.berthSource;
            berthSource.clear();
            portAndBerthServer.getBerthByPortId({portId}, function (data) {

                $.each(data.data, function (i, item) {

                    var region = item.regionMap;
                    var arr = [];
                    $.each(region, function (j, item2) {
                        arr.push(toolMap.transform(item2.lon, item2.lat));
                    });
                    simplePolygon.createBerthPolygonAndAddMap(berthSource, 48, arr, 'indexStrait', htmlTemplate.createBerthDisInfo(item));
                });
            })
        }
    };

    portClick1(feature, layer, element, popLayer) {
        $("#popup-content").html(feature.G.disinfo);
        $("#popup").addClass('popup-seaarea');
        popLayer.setPosition(this.clickSouth);

    };

    berthClick(feature, layer, element, popLayer, coordinate) {
        $("#popup-content").html(feature.get('disInfo'));
        popLayer.setPosition(this.clickSouth);

    }

    moveEnd(evt) {
        var self = this;
        var newZoomLevel = self.mapObj.map.getView().getZoom();
        if (newZoomLevel > 8) {
            self.mapObj.portLayer.setVisible(true);
        } else if (newZoomLevel < 8) {
            self.mapObj.portLayer.setVisible(false);
        }
        //船舶图层显隐
        if (newZoomLevel <= 8) {
            self.mapObj.shipLayer.setVisible(false);
            $(".shipTypeConvas").show();

        } else if (newZoomLevel >= 8) {
            self.mapObj.shipLayer.setVisible(true);
            $(".shipTypeConvas").hide();
        }
    }

    //数据canvas图层画图操作
    getDataLayer(data) {
        console.time("AddcanvasLayerTime");
        //将数据添加到canvas图层中，默认展示
        let self = this;
        this.shipDataLayer.renderLayer(data);
        console.timeEnd("AddcanvasLayerTime")
    }

    /**
     * 船舶图层添加
     * @param data
     */
    addShip(data) {
        data.map((item) => {
            console.log(item);
            this.mapObj.shipSource;
            let disInfo = htmlTemplate.createIndexShipTemplate(item);
            let coods = toolMap.transform(item.X / 1000000, item.Y / 1000000)
            let type = "portwu";
            simpleFeature.createAndAddParamPointFeature(this.mapObj.shipSource, type, disInfo, coods,item.I)
        });
        console.timeEnd("AddShipLayerTime")
    }

    clearCanvasLayer() {
        this.shipDataLayer.clearCanvasLayer();
    }

    /**
     * 数据图层，控制图层的显隐
     * @param type
     * @param status
     */
    layerShowOrHideEventFun({type,status}){
        switch(type){
            case "港口":
                this.mapObj.relationLayer.setVisible(status);
                this.mapObj.portInportentLayer.setVisible(status);
                break;
            case "泊位":
                break;
            case "锚地":
                break;
            case "海峡":
                this.mapObj.straitlayer.setVisible(status);
                break;
            case "航线":
                break;
            case "海盗区域":
                break;
            case "全球海区":
                this.mapObj.seaareaLayer.setVisible(status);
                break;
            case "全球排放区":
                this.mapObj.dischargeLayer.setVisible(status);
                break;
            case "中国排放区":
                this.mapObj.ChinadischargeLayer.setVisible(status);
                break;
        }
    }
}

export default MapListener;