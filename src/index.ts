import slugify from 'slugify';
import {
  dirCreate,
  fileJsonCreate,
  getJSON,
  Plugin,
  PluginEntry,
  PluginPack,
  validatePluginSchema,
} from '@studiorack/core';

const DIST_PATH = './out';
const REGISTRY_FILE = 'index.json';
const SEARCH_URL = 'https://api.github.com/search/repositories?q=topic:studiorack-plugin+fork:true';

async function getResults(url: string, dir: string, filename: string) {
  try {
    const registry = {
      objects: {},
      time: new Date(),
      total: 0,
    };
    const results = await getJSON(url);
    for (const result of results.items) {
      const pluginPack = await getReleases(result);
      registry.objects = Object.assign(registry.objects, pluginPack);
      registry.total += Object.keys(pluginPack).length;
    }
    console.log(registry);
    dirCreate(dir);
    fileJsonCreate(`${dir}/${filename}`, registry);
  } catch (error) {
    console.error(error);
  }
}

async function getReleases(result: any) {
  // this is temporary code to prototype multiple repo types
  const pluginPack: PluginPack = {};
  try {
    const releases = await getJSON(result.releases_url.replace('{/id}', ''));
    for (const release of releases) {
      const version = release.tag_name.replace(/[^0-9.]/g, '');
      // multiple plugins
      const pluginsJsonList = await getPlugins(
        `https://github.com/${result.full_name}/releases/download/${release.tag_name}/plugins.json`
      );
      pluginsJsonList.plugins.forEach((pluginItem: Plugin) => {
        if (pluginItem.id && pluginItem.name && pluginItem.version) {
          const plugin: PluginEntry = {
            id: slugify(`${result.full_name}/${pluginItem.id}`, { lower: true, remove: /[^\w\s$*_+~.()'"!\-:@\/]+/g }),
            version,
            versions: {},
          };
          plugin.versions[version] = {
            author: pluginItem.author,
            homepage: pluginItem.homepage,
            name: pluginItem.name,
            description: pluginItem.description,
            tags: pluginItem.tags,
            version: pluginItem.version,
            date: pluginItem.date,
            size: pluginItem.size,
          };
          if (pluginPack[plugin.id]) {
            pluginPack[plugin.id].versions[version] = plugin.versions[version];
          } else {
            pluginPack[plugin.id] = plugin;
          }
        }
      });
    }
    return pluginPack;
  } catch (error) {
    return error;
  }
}

async function getPlugins(url: string) {
  const pluginsValid: Plugin[] = [];
  const pluginsJson = await getJSON(url);
  pluginsJson.plugins.forEach((plugin: Plugin) => {
    const error = validatePluginSchema(plugin);
    if (error === false) {
      pluginsValid.push(plugin);
    } else {
      console.log(error, plugin);
    }
  });
  return { plugins: pluginsValid };
}

getResults(SEARCH_URL, DIST_PATH, REGISTRY_FILE);
