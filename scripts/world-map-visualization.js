/**
 * 世界地图可视化模块
 * 基于D3.js实现世界地图可视化，集成知识图谱数据
 */

class WorldMapVisualization {
    constructor() {
        this.mapContainer = null;
        this.svg = null;
        this.projection = null;
        this.path = null;
        this.zoom = null;
        this.countries = null;
        this.countryNodes = null;
        this.countryMapping = {};
        this.isInitialized = false;
        this.dataSourceStatus = '初始化中...';
        
        // 国家名称映射表（中英文对照）
        this.countryNameMapping = {
            '中国': 'China',
            '美国': 'United States',
            '俄罗斯': 'Russia',
            '德国': 'Germany',
            '法国': 'France',
            '英国': 'United Kingdom',
            '以色列': 'Israel',
            '瑞典': 'Sweden',
            '意大利': 'Italy',
            '日本': 'Japan',
            '奥地利': 'Austria',
            '加拿大': 'Canada',
            '澳大利亚': 'Australia',
            '印度': 'India',
            '巴西': 'Brazil',
            '韩国': 'South Korea',
            '朝鲜': 'North Korea',
            '伊朗': 'Iran',
            '土耳其': 'Turkey',
            '西班牙': 'Spain',
            '荷兰': 'Netherlands',
            '比利时': 'Belgium',
            '瑞士': 'Switzerland',
            '挪威': 'Norway',
            '芬兰': 'Finland',
            '丹麦': 'Denmark',
            '波兰': 'Poland',
            '乌克兰': 'Ukraine',
            '捷克': 'Czech Republic',
            '匈牙利': 'Hungary',
            '罗马尼亚': 'Romania',
            '希腊': 'Greece',
            '葡萄牙': 'Portugal',
            '爱尔兰': 'Ireland',
            '墨西哥': 'Mexico',
            '阿根廷': 'Argentina',
            '智利': 'Chile',
            '南非': 'South Africa',
            '埃及': 'Egypt',
            '沙特阿拉伯': 'Saudi Arabia',
            '阿联酋': 'United Arab Emirates',
            '巴基斯坦': 'Pakistan',
            '泰国': 'Thailand',
            '越南': 'Vietnam',
            '马来西亚': 'Malaysia',
            '新加坡': 'Singapore',
            '印度尼西亚': 'Indonesia',
            '菲律宾': 'Philippines'
        };
    }

    /**
     * 初始化地图可视化
     */
    async initialize() {
        try {
            console.log('开始初始化世界地图可视化模块...');
            
            // 获取地图容器并显示
            const mapVisualizationElement = document.getElementById('map-visualization');
            const mapContainerElement = document.getElementById('map-container');
            
            if (!mapVisualizationElement || !mapContainerElement) {
                throw new Error('地图容器未找到');
            }
            
            // 显示地图容器
            mapContainerElement.style.display = 'block';
            mapVisualizationElement.style.display = 'block';
            
            // 设置容器尺寸
            const width = mapContainerElement.clientWidth || 800;
            const height = mapContainerElement.clientHeight || 600;
            
            // 确保容器有合适的尺寸
            if (width === 0 || height === 0) {
                mapContainerElement.style.width = '800px';
                mapContainerElement.style.height = '600px';
            }
            
            this.mapContainer = d3.select('#map-visualization');

            // 创建SVG元素
            this.svg = this.mapContainer.append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('viewBox', `0 0 ${width} ${height}`);

            // 配置墨卡托投影
            this.projection = d3.geoMercator()
                .scale(150)
                .translate([width / 2, height / 2])
                .center([0, 20]);

            // 创建地理路径生成器
            this.path = d3.geoPath().projection(this.projection);

            // 创建主容器组,用于统一管理地图和节点的缩放/平移
            this.mainGroup = this.svg.append('g')
                .attr('class', 'map-main-group');

            // 配置缩放行为
            this.zoom = d3.zoom()
                .scaleExtent([0.5, 8])
                .on('zoom', (event) => {
                    const transform = event.transform;
                    
                    // 将变换应用到主容器组,确保地图和节点同步移动
                    this.mainGroup.attr('transform', transform);
                    
                    // 动态调整节点大小,使其保持固定的视觉大小(不随缩放改变)
                    this.mainGroup.selectAll('.country-node')
                        .attr('r', d => {
                            const baseRadius = Math.max(5, Math.min(10, 5 + d.weaponCount / 20));
                            return baseRadius / transform.k; // 除以缩放比例,保持视觉大小不变
                        })
                        .attr('stroke-width', 2 / transform.k); // 边框宽度也保持不变
                    
                    // 调整标签字体大小,保持可读性
                    this.mainGroup.selectAll('.country-label')
                        .attr('font-size', `${11 / transform.k}px`);
                });

            this.svg.call(this.zoom);

            // 加载国家数据（先加载国家数据，再加载地图数据）
            await this.loadCountryData();
            
            // 加载TopoJSON地图数据
            await this.loadMapData();
            
            this.isInitialized = true;
            this.dataSourceStatus = '已加载';
            console.log('世界地图可视化模块初始化完成');
            
            // 通知主模块地图已就绪
            if (window.knowledgeGraph) {
                window.knowledgeGraph.onMapReady();
            }
            
        } catch (error) {
            console.error('地图初始化失败:', error);
            this.dataSourceStatus = '加载失败';
            throw error;
        }
    }

    /**
     * 加载TopoJSON地图数据
     */
    async loadMapData() {
        try {
            console.log('开始加载地图数据...');
            
            // 尝试多个地图数据源
            const mapDataSources = [
                'https://cdn.jsdelivr.net/npm/world-atlas@1.1.4/world/110m.json',
                'https://unpkg.com/world-atlas@1.1.4/world/110m.json',
                'https://d3js.org/world-110m.v1.json'
            ];
            
            let topoData = null;
            let lastError = null;
            
            for (const source of mapDataSources) {
                try {
                    console.log(`尝试从 ${source} 加载地图数据...`);
                    topoData = await d3.json(source);
                    console.log(`成功从 ${source} 加载地图数据`);
                    break;
                } catch (error) {
                    console.warn(`从 ${source} 加载地图数据失败:`, error);
                    lastError = error;
                    continue;
                }
            }
            
            if (!topoData) {
                throw new Error(`所有地图数据源都加载失败: ${lastError?.message}`);
            }
            
            // 转换为GeoJSON
            this.countries = topojson.feature(topoData, topoData.objects.countries);
            
            // 在主容器组中绘制国家边界
            this.mainGroup.append('g')
                .attr('class', 'countries-group')
                .selectAll('path')
                .data(this.countries.features)
                .enter()
                .append('path')
                .attr('d', this.path)
                .attr('fill', '#f0f0f0')
                .attr('stroke', '#ccc')
                .attr('stroke-width', 0.5)
                .attr('class', 'country-boundary')
                .on('mouseover', (d, event) => this.onCountryHover(d, event))
                .on('mouseout', (d, event) => this.onCountryLeave(d, event))
                .on('click', (d, event) => this.onCountryClick(d, event));

            console.log('地图数据加载完成，共加载国家:', this.countries.features.length);
            
            // 在地图数据加载完成后绘制国家节点
            this.drawCountryNodes();
            
        } catch (error) {
            console.error('加载地图数据失败:', error);
            // 如果在线数据加载失败，尝试使用本地备用数据
            await this.loadLocalMapData();
        }
    }

    /**
     * 加载本地备用地图数据
     */
    async loadLocalMapData() {
        try {
            // 这里可以添加本地地图数据加载逻辑
            console.warn('在线地图数据加载失败，使用备用方案');
            // 可以在这里添加简单的世界地图绘制逻辑
            this.drawSimpleWorldMap();
        } catch (error) {
            console.error('本地地图数据加载失败:', error);
            throw new Error('无法加载地图数据');
        }
    }

    /**
     * 绘制简单世界地图（备用方案）
     */
    drawSimpleWorldMap() {
        // 简单的世界地图轮廓
        const worldOutline = [
            {type: 'Feature', geometry: {type: 'Polygon', coordinates: [[[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]]]}}
        ];
        
        this.svg.append('path')
            .datum({type: 'FeatureCollection', features: worldOutline})
            .attr('d', this.path)
            .attr('fill', '#f0f0f0')
            .attr('stroke', '#ccc')
            .attr('stroke-width', 1);
    }

    /**
     * 从数据库加载国家数据
     */
    async loadCountryData() {
        try {
            // 模拟从数据库加载国家数据
            const countryData = await this.fetchCountryDataFromDB();
            
            // 创建国家节点映射
            this.createCountryNodes(countryData);
            
            console.log('国家数据加载完成，共加载国家:', Object.keys(this.countryNodes).length);
            
        } catch (error) {
            console.error('加载国家数据失败:', error);
            // 使用默认国家数据
            this.createDefaultCountryNodes();
        }
    }

    /**
     * 从后端API获取国家数据
     */
    async fetchCountryDataFromDB() {
        try {
            // 调用后端API获取世界地图数据
            const response = await fetch('http://localhost:3001/api/knowledge/world-map-data');
            if (response.ok) {
                const data = await response.json();
                console.log('从后端API获取国家数据成功:', data);
                if (data.success && data.data && data.data.countries) {
                    // 转换数据格式，使用chineseName作为name字段
                    return data.data.countries.map(country => ({
                        id: country.id,
                        name: country.chineseName,
                        englishName: country.englishName,
                        code: country.code,
                        weaponCount: country.weaponCount,
                        coordinates: country.coordinates
                    }));
                }
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        } catch (error) {
            console.warn('无法从后端API获取国家数据，使用模拟数据:', error);
            return this.getMockCountryData();
        }
    }

    /**
     * 获取模拟国家数据
     */
    getMockCountryData() {
        return [
            { name: '中国', weaponCount: 150, coordinates: [104.1954, 35.8617] },
            { name: '美国', weaponCount: 200, coordinates: [-95.7129, 37.0902] },
            { name: '俄罗斯', weaponCount: 120, coordinates: [105.3188, 61.5240] },
            { name: '德国', weaponCount: 80, coordinates: [10.4515, 51.1657] },
            { name: '法国', weaponCount: 70, coordinates: [2.2137, 46.2276] },
            { name: '英国', weaponCount: 60, coordinates: [-3.4359, 55.3781] },
            { name: '以色列', weaponCount: 40, coordinates: [34.8516, 31.0461] },
            { name: '瑞典', weaponCount: 30, coordinates: [18.6435, 60.1282] },
            { name: '意大利', weaponCount: 50, coordinates: [12.5674, 41.8719] },
            { name: '日本', weaponCount: 45, coordinates: [138.2529, 36.2048] }
        ];
    }

    /**
     * 获取默认国家坐标
     */
    getDefaultCoordinates(countryName) {
        const defaultCoords = {
            '中国': [104.1954, 35.8617],
            '美国': [-95.7129, 37.0902],
            '俄罗斯': [105.3188, 61.5240],
            '德国': [10.4515, 51.1657],
            '法国': [2.2137, 46.2276],
            '英国': [-3.4359, 55.3781],
            '以色列': [34.8516, 31.0461],
            '瑞典': [18.6435, 60.1282],
            '意大利': [12.5674, 41.8719],
            '日本': [138.2529, 36.2048]
        };
        
        return defaultCoords[countryName] || [0, 0];
    }

    /**
     * 创建国家节点
     */
    createCountryNodes(countryData) {
        this.countryNodes = {};
        
        countryData.forEach(country => {
            const englishName = country.englishName || this.countryNameMapping[country.name] || country.name;
            
            // 处理坐标数据：优先使用数据库中的坐标，如果没有则使用默认坐标
            let coordinates;
            if (country.coordinates && Array.isArray(country.coordinates)) {
                coordinates = this.projection(country.coordinates);
            } else {
                // 如果没有坐标数据，使用国家名称映射的默认坐标
                const defaultCoords = this.getDefaultCoordinates(country.name);
                coordinates = this.projection(defaultCoords);
            }
            
            if (coordinates && !isNaN(coordinates[0]) && !isNaN(coordinates[1])) {
                this.countryNodes[country.name] = {
                    id: country.id,
                    name: country.name,
                    englishName: englishName,
                    weaponCount: country.weaponCount || 0,
                    coordinates: coordinates,
                    node: null
                };
            } else {
                console.warn(`国家 ${country.name} 的坐标投影失败`);
            }
        });

        // 在地图上绘制国家节点
        this.drawCountryNodes();
    }

    /**
     * 创建默认国家节点
     */
    createDefaultCountryNodes() {
        const defaultCountries = this.getMockCountryData();
        this.createCountryNodes(defaultCountries);
    }

    /**
     * 在地图上绘制国家节点
     */
    drawCountryNodes() {
        if (!this.countryNodes || Object.keys(this.countryNodes).length === 0) {
            console.warn('没有国家节点数据可绘制');
            return;
        }
        
        const nodes = Object.values(this.countryNodes);
        
        // 清除现有节点
        this.mainGroup.selectAll('.country-nodes-group').remove();
        
        // 在主容器组中创建节点分组（确保与地图同步缩放/平移）
        const nodeGroups = this.mainGroup.append('g')
            .attr('class', 'country-nodes-group')
            .selectAll('.country-node-group')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'country-node-group')
            .attr('transform', d => `translate(${d.coordinates[0]}, ${d.coordinates[1]})`);
        
        // 绘制国家节点（蓝色圆点）
        nodeGroups.append('circle')
            .attr('class', 'country-node')
            .attr('r', d => Math.max(5, Math.min(10, 5 + d.weaponCount / 20))) // 根据武器数量动态调整节点大小
            .attr('fill', '#2563eb') // 蓝色节点
            .attr('stroke', '#1e40af')
            .attr('stroke-width', 2)
            .attr('opacity', 0.85)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => this.onNodeHover(event, d))
            .on('mouseout', (event, d) => this.onNodeLeave(event, d))
            .on('click', (event, d) => this.onNodeClick(event, d));

        // 添加节点标签
        nodeGroups.append('text')
            .attr('class', 'country-label')
            .attr('x', 12)
            .attr('y', 4)
            .text(d => d.name)
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .attr('fill', '#1e40af')
            .attr('text-anchor', 'start')
            .style('pointer-events', 'none')
            .style('display', 'none');
            
        console.log('国家节点绘制完成，共绘制节点:', nodes.length);
    }

    /**
     * 国家悬停事件
     */
    onCountryHover(event, d) {
        d3.select(event.currentTarget)
            .attr('fill', '#e0e0e0')
            .attr('stroke-width', 1);
    }

    /**
     * 国家离开事件
     */
    onCountryLeave(event, d) {
        d3.select(event.currentTarget)
            .attr('fill', '#f0f0f0')
            .attr('stroke-width', 0.5);
    }

    /**
     * 国家点击事件
     */
    onCountryClick(event, d) {
        const countryName = this.getCountryNameFromFeature(d);
        console.log('点击国家:', countryName);
        
        // 触发知识图谱筛选
        if (window.knowledgeGraph) {
            window.knowledgeGraph.filterByCountry(countryName);
        }
    }

    /**
     * 节点悬停事件
     */
    onNodeHover(event, d) {
        // 获取当前缩放比例
        const currentTransform = d3.zoomTransform(this.svg.node());
        const scale = currentTransform.k;
        
        // 放大节点(考虑缩放比例)
        d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr('r', d => {
                const hoverRadius = Math.max(7, Math.min(14, 7 + d.weaponCount / 15));
                return hoverRadius / scale; // 除以缩放比例
            })
            .attr('fill', '#3b82f6')
            .attr('opacity', 1);
        
        // 显示标签
        d3.select(event.currentTarget.parentNode)
            .select('.country-label')
            .style('display', 'block');
        
        // 显示工具提示信息
        this.showTooltip(event, d);
    }

    /**
     * 节点离开事件
     */
    onNodeLeave(event, d) {
        // 获取当前缩放比例
        const currentTransform = d3.zoomTransform(this.svg.node());
        const scale = currentTransform.k;
        
        // 恢复节点大小和颜色(考虑缩放比例)
        d3.select(event.currentTarget)
            .transition()
            .duration(200)
            .attr('r', d => {
                const baseRadius = Math.max(5, Math.min(10, 5 + d.weaponCount / 20));
                return baseRadius / scale; // 除以缩放比例
            })
            .attr('fill', '#2563eb')
            .attr('opacity', 0.85);
        
        // 隐藏标签
        d3.select(event.currentTarget.parentNode)
            .select('.country-label')
            .style('display', 'none');
        
        // 隐藏工具提示
        this.hideTooltip();
    }

    /**
     * 节点点击事件
     */
    async onNodeClick(event, d) {
        console.log('点击国家节点:', d.name);
        
        // 阻止事件冒泡
        event.stopPropagation();
        
        // 高亮选中的节点
        this.highlightSelectedNode(event.currentTarget, d);
        
        // 显示国家详情信息
        await this.showCountryDetails(d);
    }

    /**
     * 从地理要素获取国家名称
     */
    getCountryNameFromFeature(feature) {
        if (!feature.properties) return '未知国家';
        
        // 尝试从不同属性字段获取国家名称
        const name = feature.properties.name || 
                    feature.properties.NAME || 
                    feature.properties.NAME_LONG || 
                    feature.properties.ADMIN || 
                    '未知国家';
        
        // 查找对应的中文名称
        for (const [chineseName, englishName] of Object.entries(this.countryNameMapping)) {
            if (englishName.toLowerCase() === name.toLowerCase()) {
                return chineseName;
            }
        }
        
        return name;
    }

    /**
     * 切换地图显示状态
     */
    toggleMap(show) {
        if (!this.isInitialized) {
            console.warn('地图模块未初始化');
            return;
        }
        
        const mapContainer = document.getElementById('map-container');
        const graphContainer = document.getElementById('graph-container');
        
        if (show) {
            mapContainer.style.display = 'block';
            graphContainer.style.display = 'none';
            this.fitMapToView();
        } else {
            mapContainer.style.display = 'none';
            graphContainer.style.display = 'block';
        }
    }

    /**
     * 调整地图适应视图
     */
    fitMapToView() {
        if (!this.countries || !this.path) return;
        
        const bounds = this.path.bounds(this.countries);
        const dx = bounds[1][0] - bounds[0][0];
        const dy = bounds[1][1] - bounds[0][1];
        const x = (bounds[0][0] + bounds[1][0]) / 2;
        const y = (bounds[0][1] + bounds[1][1]) / 2;
        const scale = 0.9 / Math.max(dx / this.svg.attr('width'), dy / this.svg.attr('height'));
        const translate = [this.svg.attr('width') / 2 - scale * x, this.svg.attr('height') / 2 - scale * y];
        
        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }

    /**
     * 更新国家数据
     */
    updateCountryData(countryData) {
        if (!this.isInitialized) return;
        
        // 清除现有节点
        this.svg.selectAll('.country-node, .country-label').remove();
        
        // 重新创建节点
        this.createCountryNodes(countryData);
    }

    /**
     * 获取数据源状态
     */
    getDataSourceStatus() {
        return this.dataSourceStatus;
    }

    /**
     * 显示工具提示
     */
    showTooltip(event, d) {
        // 移除已存在的提示框
        d3.select('.map-tooltip').remove();
        
        // 创建提示框
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'map-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.85)')
            .style('color', '#fff')
            .style('padding', '10px 15px')
            .style('border-radius', '6px')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('z-index', '10000')
            .style('box-shadow', '0 4px 6px rgba(0,0,0,0.3)')
            .html(`
                <div style="font-weight: bold; margin-bottom: 5px;">${d.name}</div>
                <div style="font-size: 12px;">武器数量: ${d.weaponCount || 0}</div>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 5px;">点击查看详情</div>
            `);
        
        // 定位提示框
        tooltip.style('left', (event.pageX + 15) + 'px')
               .style('top', (event.pageY - 10) + 'px');
    }
    
    /**
     * 隐藏工具提示
     */
    hideTooltip() {
        d3.select('.map-tooltip').remove();
    }
    
    /**
     * 高亮选中的节点
     */
    highlightSelectedNode(nodeElement, data) {
        // 取消之前选中的节点
        this.mainGroup.selectAll('.country-node')
            .classed('selected', false)
            .attr('stroke', '#1e40af')
            .attr('stroke-width', 2);
        
        // 高亮当前选中的节点
        d3.select(nodeElement)
            .classed('selected', true)
            .attr('stroke', '#fbbf24')
            .attr('stroke-width', 3);
    }
    
    /**
     * 显示国家详情信息 - 使用浮动面板
     */
    async showCountryDetails(countryData) {
        console.log('👉 开始显示国家详情:', countryData.name);
        
        // 创建或获取浮动面板
        let detailsPanel = document.getElementById('countryDetailsPanel');
        if (!detailsPanel) {
            detailsPanel = document.createElement('div');
            detailsPanel.id = 'countryDetailsPanel';
            detailsPanel.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                width: 400px;
                max-height: calc(100vh - 120px);
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                z-index: 9999;
                overflow-y: auto;
                display: none;
            `;
            document.body.appendChild(detailsPanel);
            console.log('✅ 创建浮动面板');
        }
        
        // 显示面板
        detailsPanel.style.display = 'block';
        
        // 显示加载状态
        detailsPanel.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #667eea;"></i>
                <p style="margin-top: 20px; color: #6b7280; font-size: 16px;">正在加载国家详情...</p>
            </div>
        `;
        
        try {
            const response = await fetch(`http://localhost:3001/api/knowledge/country-details/${encodeURIComponent(countryData.name)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success || !result.data) {
                throw new Error('获取国家详情失败');
            }
            
            const { basicInfo, statistics, weaponTypes, weapons, manufacturers } = result.data;
            
            console.log('📦 数据详情:', {
                basicInfo,
                statistics,
                weaponTypesCount: weaponTypes?.length,
                weaponsCount: weapons?.length,
                manufacturersCount: manufacturers?.length
            });
            
            // 构建详情界面HTML
            let detailsHTML = `
                <!-- 关闭按钮 -->
                <div style="position: sticky; top: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px 12px 0 0; z-index: 10;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; color: white; font-size: 22px;">
                            <i class="fas fa-flag"></i> ${basicInfo.chineseName}
                        </h3>
                        <button onclick="document.getElementById('countryDetailsPanel').style.display='none'" 
                                style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; transition: all 0.3s;"
                                onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                                onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                        ${basicInfo.englishName}
                        ${basicInfo.code ? `<span style="margin-left: 10px; padding: 2px 8px; background: rgba(255,255,255,0.2); border-radius: 12px; font-size: 12px;">${basicInfo.code}</span>` : ''}
                    </p>
                </div>
                
                <!-- 内容区域 -->
                <div style="padding: 20px;">
                    <!-- 统计数据 -->
                    <div style="margin-bottom: 25px;">
                        <h4 style="margin: 0 0 15px; color: #374151; font-size: 16px;">
                            <i class="fas fa-chart-bar"></i> 数据统计
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">武器数量</div>
                                <div style="font-size: 24px; font-weight: bold;">${statistics.weaponCount}</div>
                            </div>
                            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 15px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">制造商</div>
                                <div style="font-size: 24px; font-weight: bold;">${statistics.manufacturerCount}</div>
                            </div>
                            <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 15px; border-radius: 8px; text-align: center;">
                                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">类型</div>
                                <div style="font-size: 24px; font-weight: bold;">${statistics.weaponTypeCount}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 武器类型分布 -->
                    ${weaponTypes && weaponTypes.length > 0 ? `
                        <div style="margin-bottom: 25px;">
                            <h4 style="margin: 0 0 12px; color: #374151; font-size: 16px;">
                                <i class="fas fa-tags"></i> 武器类型
                            </h4>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${weaponTypes.map(wt => `
                                    <span style="display: inline-flex; align-items: center; padding: 6px 12px; background: linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%); color: #3730a3; border-radius: 16px; font-size: 12px;">
                                        ${wt.type}
                                        <span style="margin-left: 6px; padding: 2px 6px; background: #3730a3; color: white; border-radius: 10px; font-size: 10px;">${wt.count}</span>
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- 主要制造商 -->
                    ${manufacturers && manufacturers.length > 0 ? `
                        <div style="margin-bottom: 20px;">
                            <h4 style="margin: 0 0 12px; color: #374151; font-size: 16px;">
                                <i class="fas fa-industry"></i> 主要制造商 <span style="font-size: 12px; color: #9ca3af; font-weight: normal;">(前10个)</span>
                            </h4>
                            <div style="max-height: 250px; overflow-y: auto; padding-right: 5px;">
                                ${manufacturers.slice(0, 10).map((mfr, index) => `
                                    <div style="background: #fff7ed; border-left: 3px solid #f59e0b; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
                                        <div style="font-weight: 600; color: #111827; margin-bottom: 4px; font-size: 14px;">
                                            ${index + 1}. ${mfr.name}
                                        </div>
                                        ${mfr.founded ? `
                                            <div style="font-size: 11px; color: #78716c; margin-bottom: 4px;">
                                                <i class="fas fa-calendar"></i> 成立于 ${mfr.founded}
                                            </div>
                                        ` : ''}
                                        ${mfr.description ? `
                                            <div style="font-size: 12px; color: #6b7280; line-height: 1.4;">
                                                ${mfr.description.substring(0, 100)}${mfr.description.length > 100 ? '...' : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- 武器列表 -->
                    ${weapons && weapons.length > 0 ? `
                        <div style="margin-bottom: 20px;">
                            <h4 style="margin: 0 0 12px; color: #374151; font-size: 16px;">
                                <i class="fas fa-rocket"></i> 主要武器 <span style="font-size: 12px; color: #9ca3af; font-weight: normal;">(前10个)</span>
                            </h4>
                            <div style="max-height: 300px; overflow-y: auto; padding-right: 5px;">
                                ${weapons.slice(0, 10).map((weapon, index) => `
                                    <div style="background: #f9fafb; border-left: 3px solid #667eea; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
                                        <div style="font-weight: 600; color: #111827; margin-bottom: 4px; font-size: 14px;">
                                            ${index + 1}. ${weapon.name}
                                        </div>
                                        <div style="display: flex; gap: 6px; margin-bottom: 4px;">
                                            <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 10px; font-size: 11px;">
                                                ${weapon.type || '未分类'}
                                            </span>
                                            ${weapon.year ? `<span style="background: #f3f4f6; color: #4b5563; padding: 2px 8px; border-radius: 10px; font-size: 11px;">${weapon.year}</span>` : ''}
                                        </div>
                                        ${weapon.description ? `<div style="font-size: 12px; color: #6b7280; line-height: 1.4;">${weapon.description.substring(0, 80)}${weapon.description.length > 80 ? '...' : ''}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : '<p style="text-align: center; color: #9ca3af; padding: 20px;">暂无武器数据</p>'}
                </div>
            `;
            
            detailsPanel.innerHTML = detailsHTML;
            console.log('✅ 详情面板显示完成');
            
        } catch (error) {
            console.error('❌ 加载失败:', error);
            detailsPanel.innerHTML = `
                <div style="padding: 40px 20px; text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ef4444; margin-bottom: 15px;"></i>
                    <p style="color: #ef4444; font-size: 16px; font-weight: 600; margin-bottom: 8px;">加载失败</p>
                    <p style="font-size: 13px; color: #9ca3af; margin-bottom: 20px;">${error.message}</p>
                    <button onclick="document.getElementById('countryDetailsPanel').style.display='none'" 
                            style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        关闭
                    </button>
                </div>
            `;
        }
    }
    
    /**
     * 获取武器类型数量
     */
    getUniqueTypesCount(weaponsData) {
        if (!weaponsData || weaponsData.length === 0) return 0;
        const types = new Set(weaponsData.map(w => w.type).filter(t => t));
        return types.size;
    }
    
    /**
     * 在知识图谱中查看国家
     */
    viewCountryInGraph(countryName) {
        // 切换到知识图谱视图
        const viewModeSelect = document.getElementById('viewMode');
        if (viewModeSelect) {
            viewModeSelect.value = 'graph';
            viewModeSelect.dispatchEvent(new Event('change'));
        }
        
        // 在知识图谱中筛选该国家
        setTimeout(() => {
            if (window.knowledgeGraph && window.knowledgeGraph.filterByCountry) {
                window.knowledgeGraph.filterByCountry(countryName);
            }
        }, 300);
    }
    
    /**
     * 销毁地图实例
     */
    destroy() {
        if (this.svg) {
            this.svg.remove();
            this.svg = null;
        }
        this.hideTooltip();
        this.isInitialized = false;
        console.log('世界地图可视化模块已销毁');
    }
}

// 创建全局地图实例
window.worldMapVisualization = new WorldMapVisualization();

// 添加render方法以兼容现有代码
window.worldMapVisualization.render = async function(topoData, countryData) {
    if (!this.isInitialized) {
        await this.initialize();
    }
    if (topoData) {
        this.countries = topojson.feature(topoData, topoData.objects.countries);
    }
    if (countryData) {
        this.createCountryNodes(countryData);
    }
};

// 导出模块到全局作用域
window.WorldMapVisualization = WorldMapVisualization;

// 创建全局实例
window.worldMapVisualization = new WorldMapVisualization();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldMapVisualization;
}