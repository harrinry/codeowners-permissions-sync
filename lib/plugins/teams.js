// NOTE: The APIs needed for this plugin are not supported yet by GitHub Apps
// https://developer.github.com/v3/apps/available-endpoints/
const Diffable = require('./diffable')

module.exports = class Teams extends Diffable {
  find () {
    return this.github.repos.listTeams(this.repo).then(res => res.data)
  }

  comparator (existing, attrs) {
    return existing.slug === attrs.name
  }

  changed (existing, attrs) {
    return existing.permission !== attrs.permission
  }

  update (existing, attrs) {
    const params = this.toParams(existing, attrs)
    console.log(`-- -- params before: ${params}`)
    const newLocal = this.github.teams.addOrUpdateRepo(params)
    console.log(`-- -- teams: ${newLocal}`)
    return newLocal
  }

  add (attrs) {
    // There is not a way to resolve a team slug to an id without fetching all
    // teams for an organization.
    return this.allTeams.then(teams => {
      const existing = teams.find(team => this.comparator(team, attrs))

      return this.github.teams.addOrUpdateRepo(this.toParams(existing, attrs))
    })
  }

  remove (existing) {
    return this.github.teams.removeRepo(
      Object.assign({ id: existing.id }, this.repo)
    )
  }

  toParams (existing, attrs) {
    const params = {
      id: existing.id,
      team_id: existing.id,
      owner: this.repo.owner,
      org: this.repo.owner,
      repo: this.repo.repo,
      permission: attrs.permission
    }
    console.log(`-- -- params: ${JSON.stringify(params)}`)
    return params
  }

  // Lazy getter to fetch all teams for the organization
  get allTeams () {
    const getter = this.github.teams.list({ org: this.repo.owner })
      .then(this.paginate.bind(this))
      .then(responses => {
        return responses.reduce((teams, res) => {
          return teams.concat(res.data)
        }, [])
      })
    Object.defineProperty(this, 'allTeams', getter)
    return getter
  }

  // Paginator will keep fetching the next page until there are no more.
  paginate (res, records = []) {
    records = records.concat(res)
    if (res.meta && this.github.hasNextPage(res)) {
      return this.github.getNextPage(res).then(next => {
        return this.paginate(next, records)
      })
    } else {
      return Promise.resolve(records)
    }
  }
}
